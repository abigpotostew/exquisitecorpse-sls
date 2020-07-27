package static

import (
	"fmt"
	"io/ioutil"
	"mime"
	"strings"
)

type LocalService struct {
	RootFolder string
}

func (l *LocalService) Get(filename string) (File, error) {
	data, err := ioutil.ReadFile(fmt.Sprintf("%s/%s", l.RootFolder, filename))
	if err != nil {
		return File{}, err
	}

	contentType := "application/octet-stream"
	extIdx := strings.LastIndexByte(filename, '.')
	if extIdx > -1 {
		contentType = mime.TypeByExtension(filename[extIdx:])
	}

	return File{
		ContentType: contentType,
		Data:        data,
	}, nil
}
