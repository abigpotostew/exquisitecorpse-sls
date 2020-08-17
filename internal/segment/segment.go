package segment

const (
	parentMetadataKey        = "Parent"
	creatorMetadataKey       = "Creator"
	orderMetadataKey         = "Order"
	GalleryTypeMetadataValue = "Marker"
	GalleryTypeMetadataKey   = "Gallery-Type"
	COMPLETE_TORSO           = 2
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
	Order       int    `json:"order"`
	Data        []byte
}

type GalleryResponse struct {
	CompleteSegmentIds []string `json:"completeSegmentIds"`
	ContinuationToken  *string  `json:"continuationToken"`
	IsTruncated        bool     `json:"isTruncated"`
}

type GalleryQuery struct {
	ContinuationToken string `form:"q"`
	Limit             *int64
}

type Service interface {
	Create(RequestCreateSegment) (Segment, error)
	Get(id string) (Segment, error)
	GetWithData(id string) (Segment, error)
	GetGallery(query GalleryQuery) (GalleryResponse, error)
}
