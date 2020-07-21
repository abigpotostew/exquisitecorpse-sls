package main

import (
	"context"
	"log"
	"net/http"
	"os"

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

func ginHandle(service segment.Service, group *gin.RouterGroup) {
	group.GET("/api/v1/segments/:id", func(c *gin.Context) {
		out, err := service.Get(c.Param("id"))
		if err != nil {
			c.AbortWithError(http.StatusInternalServerError, err)
			return
		}

		c.JSON(200, out)
	})

	group.POST("/api/v1/segments/:parent", func(c *gin.Context) {
		if c.ContentType() != requiredImageType {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		data, err := c.GetRawData()
		if err != nil {
			c.AbortWithError(http.StatusBadRequest, err)
			return
		}

		uname, _ := c.Get(auth.UsernameCtxKey)
		parentID := c.Param("parent")

		createSeg := segment.RequestCreateSegment{
			Parent:      parentID,
			Creator:     uname.(string),
			Content:     data,
			ContentType: c.ContentType(),
		}

		out, err := service.Create(createSeg)
		if err != nil {
			c.AbortWithError(http.StatusInternalServerError, err)
			return
		}
		c.JSON(200, out)
	})

	group.POST("/api/v1/segments", func(c *gin.Context) {
		if c.ContentType() != requiredImageType {
			log.Println("invalid content type: ", c.ContentType())
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		data, err := c.GetRawData()
		if err != nil {
			c.AbortWithError(http.StatusBadRequest, err)
			return
		}
		uname, _ := c.Get(auth.UsernameCtxKey)
		createSeg := segment.RequestCreateSegment{
			Parent:      "",
			Creator:     uname.(string),
			Content:     data,
			ContentType: c.ContentType(),
			Order:       0,
		}
		out, err := service.Create(createSeg)
		if err != nil {
			c.AbortWithError(http.StatusInternalServerError, err)
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
	log.Printf("Gin cold start")
	sess := session.Must(session.NewSession())
	s3Sess := s3.New(sess)
	service := &segment.S3Service{
		S3: s3Sess, BucketName: os.Getenv("imageBucket"),
	}

	r := gin.Default()
	authorized := r.Group("/")
	authorized.Use(auth.UsernameHeaderRequired())
	ginHandle(service, authorized)

	ginLambda = ginadapter.New(r)

	lambda.Start(Handler)
}
