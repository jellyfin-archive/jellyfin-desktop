# Jellyfin Theater

Jellyfin Theater is a local client that connects to a Jellyfin server. 
Currently this takes place by contacting https://
# Building

This application is implemented as an electron app and is built off of 
a NodeJS code base. Because of this you will need to NodeJS runtime and
package manager. The following versions have been tested: 

| Software Name | Version          |
| ------------- | ---------------- |
| Node JS       | 11.5.0           |
| npm           | 6.4.1            |
| ------------- | ---------------- |


Take the following steps to build the application

```
# Get the source
git clone git@github.com:jellyfin/jellyfin-theater-electron.git
cd jellyfin-theater-electron

# Install dependancies for electron
apt-get -y install \
	libgtkextra-dev libgconf2-dev \
	libnss3 \
	libxss1 \
	libasound2 \
	libxtst-dev

# Install electron-packager
npm install -g electron-packager

# Install node dependancies
npm install

# Package using electron-packager
electron-packager .
```
