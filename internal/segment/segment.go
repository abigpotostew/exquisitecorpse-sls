package segment

import (
	"bytes"
	"errors"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/abigpotostew/exquisitecorpse-sls/internal/uuid"

	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/s3/s3iface"
)

const (
	parentMetadatKey  = "Parent"
	creatorMetadatKey = "Creator"
	orderMetadatKey   = "Order"
)

type RequestCreateSegment struct {
	Parent      string
	Creator     string
	Content     []byte
	ContentType string
	Order       int
}

type Segment struct {
	ID          string `json:"id"`
	Creator     string `json:"creator"`
	Parent      string `json:"parent"`
	ContentType string `json:"contentType"`
	URL         string `json:"url"`
	Order       int    `json:"order"`
}

type Service interface {
	Create(RequestCreateSegment) (Segment, error)
	Get(id string) (Segment, error)
}

type S3Service struct {
	S3         s3iface.S3API
	BucketName string
}

func (s *S3Service) Create(segment RequestCreateSegment) (Segment, error) {
	id := uuid.NewShort()
	body := bytes.NewReader(segment.Content)

	order := segment.Order
	//perform get on parent id
	if segment.Parent != "" {
		parent, err := s.Get(segment.Parent)
		if err != nil {
			return Segment{}, err
		}
		if parent == (Segment{}) {
			return Segment{}, errors.New("404 todo parent not found")
		}
		order = parent.Order + 1
	}

	orderStr := fmt.Sprintf("%d", order)
	metadata := map[string]*string{
		parentMetadatKey:  &segment.Parent,
		creatorMetadatKey: &segment.Creator,
		orderMetadatKey:   &orderStr,
	}
	_, err := s.S3.PutObject(&s3.PutObjectInput{
		ContentType: &segment.ContentType,
		Key:         &id,
		Bucket:      &s.BucketName,
		Body:        body,
		Metadata:    metadata,
	})
	if err != nil {
		log.Println("failed to save object to s3")
		return Segment{}, err
	}

	urlStr, err := s.url(id)
	if err != nil {
		log.Println("failed to pre-sign url")
		return Segment{}, err
	}

	return Segment{
		ID:          id,
		Creator:     segment.Creator,
		Parent:      segment.Parent,
		URL:         urlStr,
		ContentType: segment.ContentType,
	}, nil
}

func (s *S3Service) url(id string) (string, error) {
	inputPresigned, _ := s.S3.GetObjectRequest(&s3.GetObjectInput{
		Bucket: &s.BucketName,
		Key:    &id,
	})
	return inputPresigned.Presign(5 * time.Minute)
}

func (s *S3Service) Get(id string) (out Segment, err error) {
	head, err := s.head(id)
	if err != nil {
		return out, err
	}
	url, err := s.url(id)
	if err != nil {
		return out, err
	}
	order, ok := head.Metadata[orderMetadatKey]
	orderInt := 0
	if ok {
		orderInt, err = strconv.Atoi(*order)
		if err != nil {
			return Segment{}, err
		}
	}

	return Segment{
		ID:          id,
		Creator:     *head.Metadata[creatorMetadatKey],
		Parent:      *head.Metadata[parentMetadatKey],
		ContentType: *head.ContentType,
		URL:         url,
		Order:       orderInt,
	}, nil
}

func (s *S3Service) head(id string) (out *s3.HeadObjectOutput, err error) {
	head, err := s.S3.HeadObject(&s3.HeadObjectInput{
		Bucket: &s.BucketName,
		Key:    &id,
	})
	if err != nil {
		log.Printf("head object error for bucket %v\n", s.BucketName)
		return out, err
	}
	return head, err
}
