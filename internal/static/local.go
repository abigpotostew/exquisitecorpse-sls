package static

import (
	"fmt"
	"io/ioutil"
	"mime"
	"net/http"
	"os"
	"strings"

	"github.com/abigpotostew/exquisitecorpse-sls/internal/httperror"
)

type LocalService struct {
	RootFolder string
}

func (l *LocalService) Get(filename string) (File, error) {
	if strings.HasSuffix(filename, ".tmpl") {
		return File{}, httperror.NewWithDefaultErrorMessage(http.StatusNotFound)
	}

	// gin includes the leading slash
	filename = strings.TrimLeft(filename, "/")
	filepath := fmt.Sprintf("%s/%s", l.RootFolder, filename)

	// check that it exists
	if _, err := os.Stat(filepath); os.IsNotExist(err) {
		return File{}, httperror.NewWithDefaultErrorMessage(http.StatusNotFound)
	}

	data, err := ioutil.ReadFile(filepath)
	if err != nil {
		return File{}, err
	}

	// get content type
	contentType := "application/octet-stream"
	extIdx := strings.LastIndexByte(filename, '.')
	if extIdx > -1 {
		contentType = mime.TypeByExtension(filename[extIdx:])
	}

	out := File{
		ContentType: contentType,
		Data:        data,
	}

	return out, nil
}
