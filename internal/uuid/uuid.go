package uuid

import (
	"crypto/rand"
	"fmt"
)

func NewShort() (uuid string) {

	b := make([]byte, 4)
	_, err := rand.Read(b)
	if err != nil {
		fmt.Println("Error: ", err)
		return
	}

	uuid = fmt.Sprintf("%X", b)

	return
}