# Jellyfin Theater

Jellyfin Theater is a local client that connects to a Jellyfin server. 

Currently the jellyfin-theater-electron connects using http protocol.

![image](screenshots/Home.PNG)

# Building

This application is implemented as an electron app and is built off of 
a NodeJS code base. Because of this you will need to NodeJS runtime and
package manager. The following versions have been tested: 

| Software Name | Version          |
| ------------- | ---------------- |
| Node JS       | 12               |
| yarn          | 1.22             |


## Getting Started Installing Jellyfin Theater

If you are looking to use the Jellyfin Theater you will need to start by downloading this repository via the git command, or by downloading a zip. you can do so by either 

SSH

```
$ git clone git@github.com:jellyfin/jellyfin-theater-electron.git
```

HTTPS

```
$ git clone https://github.com/jellyfin/jellyfin-theater-electron.git
```

Note : If you dont have git installed you can allways download a zip by clicking the green clone or download button on the right and then clicking Download Zip

After downloading the source the source you will need to install the dependencies for the project. You can do so by typing into your terminal 

```
$ cd jellyfin-theater-electron

$ yarn install
```

Once the installation has been finished you will need to run this command in the directory to activate the program.

```
$ yarn start
```
## Jellyfin Theater Settings Location

At first launch, you will be asked to enter your server address. This parameter is kept in:

- ~~%APPDATA%/Jellyfin Theater on Windows~~ (outdated)
- ~/.config/jellyfin-desktop on Linux
- ~~\~/Library/Application Support/Jellyfin Theater on macOS~~ (outdated)

## Building And Releasing Jellyfin

Start of building and releasing by commiting as usual, then you want to run these commands for the select operating system when you begin to release a final package version of the app you will then need to install these deps using the following command

```$ npm install -g electron-packager ```

after installing this dependency you will want to create a directory called ```release/``` in the root directory.


Note :
If you are on ubuntu you may need to install additional dependencies

```
# apt-get -y install \
	libgtkextra-dev libgconf2-dev \
	libnss3 \
	libxss1 \
	libasound2 \
	libxtst-dev
```

#### Releasing For Windows

```$ npm run package-win```

#### Releasing For Linux

```$ npm run package-linux```

#### Releasing For Macintosh

```$ npm run package-mac```

## Screenshots

![image](screenshots/Login.PNG)
![image](screenshots/Movies.PNG)
![image](screenshots/TV_Shows.PNG)
![image](screenshots/Music.png)



