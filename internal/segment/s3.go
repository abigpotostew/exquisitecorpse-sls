package segment

import (
	"bytes"
	"errors"
	"fmt"
	"io/ioutil"
	"log"
	"strconv"
	"time"

	"github.com/abigpotostew/exquisitecorpse-sls/internal/uuid"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/s3/s3iface"
)

type S3Service struct {
	S3                s3iface.S3API
	BucketName        string
	GalleryBucketName string
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
		if parent.ID == "" {
			return Segment{}, errors.New("404 todo parent not found")
		}
		order = parent.Order + 1
	}

	orderStr := fmt.Sprintf("%d", order)
	metadata := map[string]*string{
		parentMetadataKey:  &segment.Parent,
		creatorMetadataKey: &segment.Creator,
		orderMetadataKey:   &orderStr,
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

	if order == COMPLETE_TORSO {
		typeKey := GalleryTypeMetadataValue
		metadata := map[string]*string{
			GalleryTypeMetadataKey: &typeKey,
		}
		_, err = s.S3.PutObject(&s3.PutObjectInput{
			Key:      &id,
			Bucket:   &s.GalleryBucketName,
			Body:     bytes.NewReader([]byte("")),
			Metadata: metadata,
		})
		if err != nil {
			log.Println("failed to save gallery object to s3")
			return Segment{}, err
		}
	}

	//urlStr, err := s.url(id)
	//if err != nil {
	//	log.Println("failed to pre-sign url")
	//	return Segment{}, err
	//}

	return Segment{
		ID:      id,
		Creator: segment.Creator,
		Parent:  segment.Parent,
		//URL:         urlStr,
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

func (s *S3Service) contents(id string) ([]byte, error) {
	obj, err := s.S3.GetObject(&s3.GetObjectInput{
		Bucket: &s.BucketName,
		Key:    &id,
	})
	if err != nil {
		return nil, err
	}
	return ioutil.ReadAll(obj.Body)
}

func (s *S3Service) Get(id string) (out Segment, err error) {
	head, err := s.head(id)
	if err != nil {
		return out, err
	}
	objData, err := s.contents(id)
	if err != nil {
		return out, err
	}
	order, ok := head.Metadata[orderMetadataKey]
	orderInt := 0
	if ok {
		orderInt, err = strconv.Atoi(*order)
		if err != nil {
			return Segment{}, err
		}
	}

	return Segment{
		ID:          id,
		Creator:     *head.Metadata[creatorMetadataKey],
		Parent:      *head.Metadata[parentMetadataKey],
		ContentType: *head.ContentType,
		//URL:         url,
		Data:  objData,
		Order: orderInt,
	}, nil
}

func (s *S3Service) GetWithData(id string) (out Segment, err error) {
	head, err := s.head(id)
	if err != nil {
		return out, err
	}
	objData, err := s.contents(id)
	if err != nil {
		return out, err
	}
	order, ok := head.Metadata[orderMetadataKey]
	orderInt := 0
	if ok {
		orderInt, err = strconv.Atoi(*order)
		if err != nil {
			return Segment{}, err
		}
	}

	return Segment{
		ID:          id,
		Creator:     *head.Metadata[creatorMetadataKey],
		Parent:      *head.Metadata[parentMetadataKey],
		ContentType: *head.ContentType,
		//URL:         url,
		Data:  objData,
		Order: orderInt,
	}, nil
}

func (s *S3Service) get(id string, includeData bool) (out Segment, err error) {
	head, err := s.head(id)
	if err != nil {
		return out, err
	}
	var objData []byte
	if includeData {
		objData, err = s.contents(id)
		if err != nil {
			return out, err
		}
	}
	order, ok := head.Metadata[orderMetadataKey]
	orderInt := 0
	if ok {
		orderInt, err = strconv.Atoi(*order)
		if err != nil {
			return Segment{}, err
		}
	}

	return Segment{
		ID:          id,
		Creator:     *head.Metadata[creatorMetadataKey],
		Parent:      *head.Metadata[parentMetadataKey],
		ContentType: *head.ContentType,
		//URL:         url,
		Data:  objData,
		Order: orderInt,
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

func (s *S3Service) GetGallery(query GalleryQuery) (GalleryResponse, error) {
	var continuationToken *string
	if query.ContinuationToken != "" {
		continuationToken = &query.ContinuationToken
	}
	output, err := s.S3.ListObjects(&s3.ListObjectsInput{
		Bucket:  &s.GalleryBucketName,
		Marker:  continuationToken,
		MaxKeys: query.Limit,
	})
	if err != nil {
		log.Printf("cannot list gallery for page %v and bucket %v", continuationToken, s.GalleryBucketName)
		return GalleryResponse{}, err
	}

	completeSegmentIds := make([]string, 0)
	for _, v := range output.Contents {
		completeSegmentIds = append(completeSegmentIds, *v.Key)
	}

	var nextMarker *string
	if *output.IsTruncated {
		nextMarker = &completeSegmentIds[len(completeSegmentIds)-1]
	}
	return GalleryResponse{
		CompleteSegmentIds: completeSegmentIds,
		ContinuationToken:  nextMarker,
		IsTruncated:        *output.IsTruncated,
	}, nil
}
