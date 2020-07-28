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

func fetchForId(c *gin.Context, service segment.Service, segmentId string) ([]SegmentData, error) {
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
		}
	}
	return segmentData, nil
}

func ginHandle(service segment.Service, staticService static.Service, group *gin.RouterGroup) {
	group.GET("/", func(c *gin.Context) {

		//index, err := staticService.Get("index.html.tmpl")
		//if err != nil {
		//	c.Error(err)
		//	c.JSON(httperror.Response(err))
		//	return
		//}
		data := SingletonPageData{}

		c.HTML(http.StatusOK, "index.html.tmpl", data)
		//c.Data(200, index.ContentType, index.Data)
	})

	group.GET("/game/:id", func(c *gin.Context) {
		//index, err := staticService.Get("index.html")
		//if err != nil {
		//	c.Error(err)
		//	c.JSON(httperror.Response(err))
		//	return
		//}

		segmentData, err := fetchForId(c, service, c.Param("id)"))
		if err != nil {
			c.Error(err)
			c.JSON(httperror.Response(err))
			return
		}
		data := SingletonPageData{Segments: segmentData}

		c.HTML(http.StatusOK, "index.html.tmpl", data)

		//c.Data(200, index.ContentType, index.Data)
	})

	group.GET("/gallery", func(c *gin.Context) {

		query := segment.GalleryQuery{
			ContinuationToken: c.Query("q"),
			Limit:             nil,
		}

		out, err := service.GetGallery(query)
		if err != nil {
			c.Error(err)
			c.JSON(httperror.Response(err))
			return
		}

		allSegments := make([]SegmentData, 0)
		for _, v := range out.CompleteSegmentIds {
			res, err := fetchForId(c, service, v)
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
		//
		//index, err := staticService.Get("index.html")
		//if err != nil {
		//	c.Error(err)
		//	c.JSON(httperror.Response(err))
		//	return
		//}
		//
		//c.Data(200, index.ContentType, index.Data)
	})

	group.GET("/static/*path", func(c *gin.Context) {
		index, err := staticService.Get(c.Param("path"))
		if err != nil {
			c.Error(err)
			c.JSON(httperror.Response(err))
			return
		}
		c.Data(200, index.ContentType, index.Data)
	})

	group.GET("/api/v1/gallery", func(c *gin.Context) {
		var query segment.GalleryQuery
		if err := c.ShouldBindQuery(&query); err != nil {
			c.Error(err)
			c.JSON(httperror.Response(httperror.New(http.StatusBadRequest, err.Error())))
			return
		}

		if query.Limit == nil || *query.Limit == 0 {
			var limit int64 = 10
			query.Limit = &limit
		}

		res, err := service.GetGallery(query)
		if err != nil {
			c.Error(err)
			c.JSON(httperror.Response(err))
			return
		}

		c.JSON(http.StatusOK, res)
	})

	//group.GET("/api/v1/segments/:id", func(c *gin.Context) {
	//	out, err := service.Get(c.Param("id"))
	//	if err != nil {
	//		c.Error(err)
	//		c.JSON(httperror.Response(err))
	//		return
	//	}
	//
	//	c.JSON(200, out)
	//})

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
