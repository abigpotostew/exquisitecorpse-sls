package main

import (
	"context"
	"html/template"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/abigpotostew/exquisitecorpse-sls/internal/httperror"

	"github.com/abigpotostew/exquisitecorpse-sls/internal/static"

	"github.com/abigpotostew/exquisitecorpse-sls/internal/auth"
	"github.com/abigpotostew/exquisitecorpse-sls/internal/segment"
	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	ginadapter "github.com/awslabs/aws-lambda-go-api-proxy/gin"
	"github.com/gin-gonic/gin"
)

var ginLambda *ginadapter.GinLambda

const requiredImageType = "image/png"

type SegmentData struct {
	Id         string
	ContentSrc template.URL
	Order      string
	Creator    string
	Parent     string
	Group      int
}
type SingletonPageData struct {
	Segments    []SegmentData
	IsTruncated bool //todo find a more elegant way to skip loading the gallery pagination button
}

type GalleryPageData struct {
	Segments         []SegmentData
	GalleryNextToken string
	IsTruncated      bool
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
			Group:      group,
		}
	}
	return segmentData, nil
}

func ginHandle(service segment.Service, staticService static.Service, group *gin.RouterGroup) {

	staticFs := http.Dir("static")

	group.GET("/", func(c *gin.Context) {
		data := SingletonPageData{}
		c.HTML(http.StatusOK, "index.html.tmpl", data)
	})

	group.GET("/robots.txt", func(c *gin.Context) {
		c.FileFromFS("robots.txt", staticFs)

		//c.File("static/robots.txt")
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
		data := SingletonPageData{Segments: segmentData}

		c.HTML(http.StatusOK, "index.html.tmpl", data)
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
		for i, v := range out.CompleteSegmentIds {
			res, err := fetchForId(c, service, v, i)
			if err != nil {
				c.Error(err)
				c.JSON(httperror.Response(err))
				return
			}
			for _, v := range res {
				allSegments = append(allSegments, v)
			}
		}

		galleryNextToken := ""
		if out.ContinuationToken != nil {
			galleryNextToken = *out.ContinuationToken
		}
		data := GalleryPageData{
			Segments:         allSegments,
			GalleryNextToken: galleryNextToken,
			IsTruncated:      out.IsTruncated,
		}

		c.HTML(http.StatusOK, "index.html.tmpl", data)
	})

	group.GET("/static/*path", func(c *gin.Context) {
		c.FileFromFS(c.Param("path"), staticFs)
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
	})
}

func Handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// If no name is provided in the HTTP request body, throw an error
	return ginLambda.ProxyWithContext(ctx, req)
}

func main() {
	sess := session.Must(session.NewSession())
	s3Sess := s3.New(sess)
	service := &segment.S3Service{
		S3: s3Sess, BucketName: os.Getenv("imageBucket"),
		GalleryBucketName: os.Getenv("galleryBucket"),
	}

	var staticService static.Service
	if os.Getenv("LOCAL_STATIC_SERVER_DIR") != "" {
		dir := os.Getenv("LOCAL_STATIC_SERVER_DIR")
		staticService = &static.LocalService{RootFolder: dir}
		log.Printf("Loaded local static service at directory %v", dir)
	} else {
		staticService = &static.S3Service{S3: s3Sess, BucketName: os.Getenv("staticBucket")}
		log.Printf("Loaded S3 static service")
	}

	r := gin.Default()
	r.LoadHTMLFiles("static/index.html.tmpl")
	authorized := r.Group("/")
	authorized.Use(auth.UsernameContext())
	ginHandle(service, staticService, authorized)
	if os.Getenv("LOCALHOST_PORT") != "" {
		log.Println("Running as localhost on port 8080")
		r.Run()
	} else {
		log.Println("Running as lambda")
		ginLambda = ginadapter.New(r)
		lambda.Start(Handler)
	}
}
