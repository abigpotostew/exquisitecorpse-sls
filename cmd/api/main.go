package main

import (
	"html/template"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"

	"github.com/abigpotostew/exquisitecorpse-sls/internal/httperror"
	"golang.org/x/sync/errgroup"

	templates "github.com/abigpotostew/exquisitecorpse-sls"
	"github.com/abigpotostew/exquisitecorpse-sls/internal/static"

	"github.com/abigpotostew/exquisitecorpse-sls/internal/auth"
	"github.com/abigpotostew/exquisitecorpse-sls/internal/segment"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/gin-gonic/gin"
)

const requiredImageType = "image/png"

type SegmentData struct {
	Id         string
	ContentSrc template.URL
	Order      string
	Creator    string
	Parent     string
	Group      int
}

type HomePageData struct {
	Segments    []SegmentData
	Title       string
	RelativeUrl string
	Hostname    string
}

type AboutPageData struct {
	Title       string
	RelativeUrl string
	Hostname    string
}

type GalleryPageData struct {
	Segments         []SegmentData
	GalleryNextToken string
	IsTruncated      bool
	Title            string
	RelativeUrl      string
	Hostname         string
}

func fetchForId(c *gin.Context, service segment.Service, segmentId string, group int) ([]SegmentData, error) {
	segments := make([]segment.Segment, 0)
	currId := segmentId
	var err error
	var segmentLoop segment.Segment
	for {
		segmentLoop, err = service.GetWithData(currId)
		if err != nil {
			break
		}
		segments = append(segments, segmentLoop)
		if segmentLoop.Parent != "" {
			currId = segmentLoop.Parent
		} else {
			break
		}
	}
	if err != nil {
		c.Error(err)
		c.JSON(httperror.Response(err))
		return nil, err
	}

	segmentData := make([]SegmentData, len(segments))
	for i, s := range segments {
		segmentData[i] = SegmentData{
			Id:         s.ID,
			ContentSrc: template.URL(s.Data),
			Order:      strconv.Itoa(s.Order),
			Creator:    s.Creator,
			Parent:     s.Parent,

			Group: group,
		}
	}
	return segmentData, nil
}

func ginHandle(service segment.Service, staticService static.Service, group *gin.RouterGroup) {

	hostname := os.Getenv("HOSTNAME")
	if hostname == "" {
		hostname = "https://playexquisitecorpse.com"
	}

	// Get the embedded dist filesystem
	distFS, err := fs.Sub(templates.FS, "dist")
	if err != nil {
		panic(err)
	}
	staticFs := http.FS(distFS)

	group.GET("/", func(c *gin.Context) {
		data := HomePageData{RelativeUrl: "/", Hostname: hostname}
		c.HTML(http.StatusOK, "index.html.tmpl", data)
	})

	group.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	group.GET("/robots.txt", func(c *gin.Context) {
		c.FileFromFS("robots.txt", staticFs)
	})

	group.GET("/share.jpg", func(c *gin.Context) {
		c.FileFromFS("share.jpg", staticFs)
	})

	group.GET("/game/:id", func(c *gin.Context) {
		if c.Param("id") == "" {
			c.JSON(httperror.Response(httperror.New(http.StatusBadRequest, "game id is empty")))
			return
		}
		segmentData, err := fetchForId(c, service, c.Param("id"), 0)
		if err != nil {
			c.Error(err)
			c.JSON(httperror.Response(err))
			return
		}
		data := HomePageData{Segments: segmentData, Title: "", RelativeUrl: "/game/" + c.Param("id")}

		c.HTML(http.StatusOK, "index.html.tmpl", data)
	})

	group.GET("/about", func(c *gin.Context) {
		data := AboutPageData{Title: "About - ", RelativeUrl: "/about", Hostname: hostname}
		c.HTML(http.StatusOK, "about.html.tmpl", data)
	})

	group.GET("/gallery", func(c *gin.Context) {

		var limit int64 = 5
		query := segment.GalleryQuery{
			ContinuationToken: c.Query("q"),
			Limit:             &limit,
		}

		out, err := service.GetGallery(query)
		if err != nil {
			c.Error(err)
			c.JSON(httperror.Response(err))
			return
		}

		allSegments := make([]SegmentData, 0)
		wg := new(errgroup.Group)
		mux := new(sync.Mutex)
		for i, v := range out.CompleteSegmentIds {
			id := v
			group := i
			wg.Go(func() error {
				res, err := fetchForId(c, service, id, group)
				if err != nil {
					return err
				}
				mux.Lock()
				defer mux.Unlock()
				for _, v := range res {
					allSegments = append(allSegments, v)
				}
				return nil
			})
		}
		if err := wg.Wait(); err != nil {
			c.Error(err)
			c.JSON(httperror.Response(err))
			return
		}

		url := "/gallery"

		galleryNextToken := ""
		if out.ContinuationToken != nil {
			galleryNextToken = *out.ContinuationToken
			url = url + "?q=" + galleryNextToken
		}
		data := GalleryPageData{
			Segments:         allSegments,
			GalleryNextToken: galleryNextToken,
			IsTruncated:      out.IsTruncated,
			Title:            "Gallery - ",
			RelativeUrl:      url,
			Hostname:         hostname,
		}

		c.HTML(http.StatusOK, "gallery.html.tmpl", data)
	})

	group.GET("/static/*path", func(c *gin.Context) {
		c.FileFromFS(strings.TrimPrefix(c.Param("path"), "/"), staticFs)
	})

	group.POST("/api/v1/segments/:parent", func(c *gin.Context) {

		if c.ContentType() != requiredImageType {
			c.JSON(httperror.Response(httperror.New(http.StatusBadRequest, "missing required content type")))
			return
		}
		data, err := c.GetRawData()
		if err != nil {
			c.JSON(httperror.Response(httperror.New(http.StatusBadRequest, "cannot get content body")))
			return
		}
		if !auth.HasUsername(c) {
			c.JSON(httperror.Response(httperror.NewWithDefaultErrorMessage(http.StatusUnauthorized)))
			return
		}

		parentID := c.Param("parent")

		createSeg := segment.RequestCreateSegment{
			Parent:      parentID,
			Creator:     auth.GetUsername(c),
			Content:     data,
			ContentType: c.ContentType(),
		}

		out, err := service.Create(createSeg)
		if err != nil {
			c.Error(err)
			c.JSON(httperror.Response(err))
			return
		}
		c.JSON(200, out)
	})

	group.POST("/api/v1/segments", func(c *gin.Context) {
		handleCreate(c, service)
	})
}

func handleCreate(c *gin.Context, service segment.Service) {
	if c.ContentType() != requiredImageType {
		c.JSON(httperror.Response(httperror.New(http.StatusBadRequest, "invalid content type: "+c.ContentType())))
		return
	}
	data, err := c.GetRawData()
	if err != nil {
		c.JSON(httperror.Response(httperror.New(http.StatusBadRequest, "cannot get content body")))
		return
	}
	if !auth.HasUsername(c) {
		c.JSON(httperror.Response(httperror.NewWithDefaultErrorMessage(http.StatusUnauthorized)))
		return
	}

	createSeg := segment.RequestCreateSegment{
		Parent:      "",
		Creator:     auth.GetUsername(c),
		Content:     data,
		ContentType: c.ContentType(),
		Order:       0,
	}
	out, err := service.Create(createSeg)
	if err != nil {
		c.Error(err)
		c.JSON(httperror.Response(err))
		return
	}
	c.JSON(http.StatusCreated, out)

}

func main() {
	//possibly load from env variables
	secretKey := os.Getenv("AWS_SECRET_KEY")
	accessKey := os.Getenv("AWS_ACCESS_KEY")
	var sess *session.Session
	if secretKey != "" && accessKey != "" {
		sess = session.Must(session.NewSession(&aws.Config{
			Credentials: credentials.NewStaticCredentials(accessKey, secretKey, ""),
			Region:      aws.String(os.Getenv("AWS_REGION")),
		}))

	} else {
		sess = session.Must(session.NewSession())
	}
	s3Sess := s3.New(sess)
	service := &segment.S3Service{
		S3: s3Sess, BucketName: os.Getenv("imageBucket"),
		GalleryBucketName: os.Getenv("galleryBucket"),
	}

	// println("LOCAL_STATIC_SERVER_DIR", os.Getenv("LOCAL_STATIC_SERVER_DIR"))
	println("HOSTNAME", os.Getenv("HOSTNAME"))

	var staticService static.Service
	// if os.Getenv("LOCAL_STATIC_SERVER_DIR") != "" {
	dir := os.Getenv("LOCAL_STATIC_SERVER_DIR")
	staticService = &static.LocalService{RootFolder: dir}
	log.Printf("Loaded local static service at directory %v", dir)
	// } else {
	// 	staticService = &static.S3Service{S3: s3Sess, BucketName: os.Getenv("staticBucket")}
	// 	log.Printf("Loaded S3 static service")
	// }

	r := gin.Default()

	// Load templates from embedded filesystem
	tmpl := template.Must(template.New("").ParseFS(templates.FS, "dist/*.tmpl"))
	r.SetHTMLTemplate(tmpl)

	authorized := r.Group("/")
	authorized.Use(auth.UsernameContext())
	//authorized.Use(middleware.Header())
	ginHandle(service, staticService, authorized)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Println("Running as localhost on port", port)
	r.Run(":" + port)
}
