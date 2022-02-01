package middleware

import (
	"github.com/gin-gonic/gin"
)

func Header() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Header.Add("Bypass-Tunnel-Reminder", "true")
	}
}
