# Docker Setup for Speech-to-Text App

This document explains how to build and run the Speech-to-Text application using Docker.

## Prerequisites

- Docker and Docker Compose installed on your server
- Your `.env.local` file with all necessary API keys and credentials
- The `sttkey.json` file for Google Cloud Speech-to-Text API

## Building and Running the Application

1. Make sure your `.env.local` and `sttkey.json` files are in the project root directory.

2. Build and start the Docker container:

```bash
docker-compose up -d
```

This will:
- Build the Docker image using the Dockerfile
- Start the container in detached mode
- Map port 8081 on your host to port 8081 in the container
- Mount your `sttkey.json` file into the container
- Load environment variables from `.env.local`

3. Access the application at:

```
http://your-server-ip:8081
```

## Stopping the Application

To stop the application:

```bash
docker-compose down
```

## Viewing Logs

To view the application logs:

```bash
docker-compose logs -f
```

## Rebuilding After Changes

If you make changes to the application, rebuild and restart:

```bash
docker-compose up -d --build
```

## Troubleshooting

If you encounter issues:

1. Check the logs: `docker-compose logs -f`
2. Verify your `.env.local` file contains all required environment variables
3. Ensure `sttkey.json` is properly formatted and contains valid credentials
4. Make sure port 8081 is not being used by another service on your server 