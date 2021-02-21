### Associative Information System

This project is the backend for the application

## SETUP

Create a .env file in the root directory with the following variables:

- PORT='1000'
- APP_NAME='app_name'
- DATABASE='database_name'
- DATABASE_USER='database_user'
- DATABASE_PASSWORD='database_password'
- DATABASE_HOST='127.0.0.1'
- CLIENT_URL='https://yoursite.com'
- JWT_SECRET='your_jwt_secret'
- REFRESH_TOKEN_SECRET='your_refresh_token_secret'
- PRODUCTION=false

It should also be noted that for now, the app is designed with postgres in mind and is configured to use it. this may change in the future but for now for the server to work you'll need to have a postgres database

## Note

This is a work in progress at the moment and isn't really intended for distribution yet. Will update this page once the work is further along.
