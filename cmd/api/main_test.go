package main

import (
	"bytes"
	"encoding/json"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/abigpotostew/exquisitecorpse-sls/internal/auth"
	"github.com/abigpotostew/exquisitecorpse-sls/internal/segment"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHandler(t *testing.T) {
	sess := session.Must(session.NewSession())
	s3Sess := s3.New(sess)

	router := gin.Default()
	group := router.Group("/")
	group.Use(auth.UsernameHeaderRequired())
	service := &segment.S3Service{
		S3:         s3Sess,
		BucketName: "exquisitecorpse-dev-us-west-1-images",
	}
	ginHandle(service, group)

	w := httptest.NewRecorder()
	//reqSeg:=segment.RequestCreateSegment{
	//	Parent:      "",
	//	Creator:     "testUser",
	//	Content:     []byte("yo"),
	//	ContentType: "image/png",
	//}
	inputFileBytes, err := ioutil.ReadFile("testdata/lambda.png")
	require.NoError(t, err)

	//require.NoError(t,err)
	req, _ := http.NewRequest("POST", "/api/v1/segments", bytes.NewReader(inputFileBytes))
	req.Header.Set("Content-Type", "image/png")
	req.Header.Set(auth.UsernameHeader, "testUser")
	router.ServeHTTP(w, req)

	assert.Equal(t, 201, w.Code)

	var resBody segment.Segment
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resBody))
	t.Log(resBody.URL)
	t.Log("ID", resBody.ID)
	imageGet, err := http.Get(resBody.URL)
	require.NoError(t, err)
	imageBytes, err := ioutil.ReadAll(imageGet.Body)
	require.NoError(t, err)
	assert.Equal(t, inputFileBytes, imageBytes)
	//assert.Equal(t, "pong", w.Body.String())
}
