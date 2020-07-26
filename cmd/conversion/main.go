package main

import (
	"bytes"
	"log"
	"os"

	"github.com/aws/aws-sdk-go/aws/awserr"

	"github.com/abigpotostew/exquisitecorpse-sls/internal/segment"

	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
)

func main() {
	sess := session.Must(session.NewSession())
	s3Sess := s3.New(sess)

	bucketName := os.Getenv("imageBucket")
	galleryBucketName := os.Getenv("galleryBucket")

	if bucketName == "" {
		panic("empty image bucket name")
	}
	if galleryBucketName == "" {
		panic("empty gallery bucket name")
	}

	segmentService := &segment.S3Service{
		S3:                s3Sess,
		BucketName:        bucketName,
		GalleryBucketName: galleryBucketName,
	}

	allImages := make([]string, 0)
	s3Sess.ListObjectsV2Pages(&s3.ListObjectsV2Input{
		Bucket: &bucketName,
	}, func(output *s3.ListObjectsV2Output, lastPage bool) bool {
		for _, o := range output.Contents {
			allImages = append(allImages, *o.Key)
		}
		return lastPage
	})

	completeCorpse := make([]segment.Segment, 0)
	for _, v := range allImages {
		//output, err:=s3Sess.HeadObject(&s3.HeadObjectInput{
		//	Bucket: &bucketName,
		//	Key:    &k,
		//})
		seg, err := segmentService.Get(v)
		if err != nil {
			panic(err)
		}
		if seg.Order == segment.COMPLETE_TORSO {
			completeCorpse = append(completeCorpse, seg)
		}
	}

	missingGalleryEntry := make([]segment.Segment, 0)
	for _, v := range completeCorpse {
		_, err := s3Sess.HeadObject(&s3.HeadObjectInput{
			Bucket: &galleryBucketName,
			Key:    &v.ID,
		})
		if err != nil {
			if aerr, ok := err.(awserr.Error); ok {
				switch aerr.Code() {
				case s3.ErrCodeNoSuchKey, "NotFound":
					missingGalleryEntry = append(missingGalleryEntry, v)
					break
				default:
					panic(err)
				}
			} else {
				// Print the error, cast err to awserr.Error to get the Code and
				// Message from an error.
				panic(err)
			}
		}
	}

	log.Printf("total images: \t\t%d", len(allImages))
	log.Printf("finished corpses: \t\t%d", len(completeCorpse))
	log.Printf("missing gallery: \t\t%d", len(missingGalleryEntry))
	log.Printf("existing gallery entry: \t\t%d", len(completeCorpse)-len(missingGalleryEntry))

	log.Println("missing entries to be created in gallery bucket...")
	for _, v := range missingGalleryEntry {
		log.Println(v.ID)

		typeKey := segment.GalleryTypeMetadataValue
		metadata := map[string]*string{
			segment.GalleryTypeMetadataKey: &typeKey,
		}
		_, err := s3Sess.PutObject(&s3.PutObjectInput{
			Key:      &v.ID,
			Bucket:   &galleryBucketName,
			Body:     bytes.NewReader([]byte("")),
			Metadata: metadata,
		})
		if err != nil {
			panic("failed to save gallery object to s3")
		}
	}

	log.Println("done")
}
