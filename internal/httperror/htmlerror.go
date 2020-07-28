package httperror

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// httpError is an Error which should be interpreted as an error encountered during an HTTP request.
type httpError struct {
	status  int
	message string
}

// New instantiates a httpError, associating a message with an HTTP status code.
func New(status int, message string) error {
	return httpError{status, message}
}

// New instantiates a httpError, associating a message with an HTTP status code.
func NewWithDefaultErrorMessage(status int) error {
	return httpError{status, http.StatusText(status)}
}

func (e httpError) Error() string {
	return e.message
}

func (e httpError) Status() int {
	return e.status
}

// Response accepts an error and returns a statuscode/message tuple for use in gin HTTP responses.
func Response(err error) (int, interface{}) {
	switch err := err.(type) {
	case httpError:
		return err.status, Format(err.message)
	default:
		log.Println("Unknown error", err)
		return Response(NewWithDefaultErrorMessage(http.StatusInternalServerError))
	}
}

// Format builds a formatted error message for use in gin HTTP responses.
func Format(message string) interface{} {
	return gin.H{"error": message}
}
