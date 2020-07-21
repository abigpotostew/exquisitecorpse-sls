package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

const (
	UsernameHeader = "X-User-Name"
	UsernameCtxKey = "username"
)

func UsernameHeaderRequired() gin.HandlerFunc {
	return func(c *gin.Context) {

		uname := c.GetHeader(UsernameHeader)
		var err error
		if uname == "" {
			uname, err = c.Cookie(UsernameCtxKey)
			if err != nil {
				c.Error(err)
				c.Status(http.StatusUnauthorized)
				c.Abort()
			}
			if uname == "" {
				c.Status(http.StatusUnauthorized)
				c.Abort()
			}
		}
		c.Set(UsernameCtxKey, uname)
	}
}
