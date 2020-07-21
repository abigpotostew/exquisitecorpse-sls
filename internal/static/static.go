package static

import (
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/s3/s3iface"
	"io/ioutil"
	"log"
)

type File struct{
	ContentType string
	Data []byte
}

type Service interface{
	Get(filename string) (File, error)
}

type S3Service struct {
	S3 s3iface.S3API
	BucketName string
}

func (s *S3Service) Get(filename string) (File, error) {
	head,err:=s.S3.HeadObject(&s3.HeadObjectInput{
		Bucket: &s.BucketName, Key: &filename,
	})
	if err!=nil{
		log.Printf("head object error for bucket %v\n",s.BucketName)
		return File{},err
	}

	get,err:=s.S3.GetObject(&s3.GetObjectInput{Bucket: &s.BucketName, Key: &filename})
	if err!= nil{
		log.Printf("get object error for bucket %v\n",s.BucketName)
		return File{}, err
	}
	body,err := ioutil.ReadAll(get.Body)
	if err!= nil{
		return File{}, err
	}
	return File{
		ContentType: *head.ContentType,
		Data:      body  ,
	},nil
}
