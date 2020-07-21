A website to play the art game exquisite corpse.


Prerequisites:
    - https://www.serverless.com/plugins/serverless-s3-deploy
    - your domain name must be registered manually and linked to the api gateway custom domain manually.
    - add CORS for your domain to the images s3 bucket manually for now. 
        - make sure to add cors for GET for both "www.yourdomain.com" and "yourdomain.com" 