A website to play the art game exquisite corpse.

This is live at https://www.playexquisitecorpse.com


### Prerequisites:
    - https://www.serverless.com/plugins/serverless-s3-deploy
    - install npm i serverless-api-gateway-throttling
    - your domain name must be registered manually and linked to the api gateway custom domain manually.
    - add CORS for your domain to the images s3 bucket manually for now. 
        - make sure to add cors for GET for both "www.yourdomain.com" and "yourdomain.com" 
        
### Development
Run most of the app locally so you can quickly iterate on javascript and html changes by running cmd/api/main.go with the following environment:
* imageBucket=exquisitecorpse-dev-us-west-1-images; // you need to change the service name so you have a unique bucket name
* galleryBucket=exquisitecorpse-dev-us-west-1-gallery; // you need to change the service name so you have a unique bucket name
* LOCAL_STATIC_SERVER_DIR=<git root dir>/static;
* LOCALHOST_PORT=8080; // the port number is actually ignoreed at the moment, but this is still needed
*  // aws variables