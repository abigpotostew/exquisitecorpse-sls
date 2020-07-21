package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

const (
	UsernameHeader     = "X-User-Name"
	UsernameCtxKey     = "username"
	EmptyUsernameValue = ""
)

func UsernameContext() gin.HandlerFunc {
	return func(c *gin.Context) {

		uname := c.GetHeader(UsernameHeader)
		var err error
		if uname == EmptyUsernameValue {
			uname, err = c.Cookie(UsernameCtxKey)
			if err != nil && err != http.ErrNoCookie {
				c.Error(err)
				c.Status(http.StatusUnauthorized)
				c.Abort()
			}
		}
		if uname != EmptyUsernameValue {
			c.Set(UsernameCtxKey, uname)
		}
	}
}

func HasUsername(c *gin.Context) bool {
	uname, ok := c.Get(UsernameCtxKey)
	return ok && uname != EmptyUsernameValue
}
func GetUsername(c *gin.Context) string {
	if !HasUsername(c) {
		return EmptyUsernameValue
	}
	uname, _ := c.Get(UsernameCtxKey)
	return uname.(string)
}
