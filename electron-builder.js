const debDependenyDefault = ["gconf2", "gconf-service", "libnotify4", "libappindicator1", "libxtst6", "libnss3"];

function targetConf(targets, arch) {
    return targets.map((target) => ({
        target,
        arch
    }));
}

module.exports = {
    appId: "org.jellyfin.desktop",
    mac: {
        category: "public.app-category.video",
        icon: "icons/icon.icns",
        target: targetConf([
            "dir",
            "dmg",
            "pkg"
        ], [
            "x64"
        ])
    },
    linux: {
        icon: "icons",
        category: "AudioVideo",
        target: targetConf([
            "AppImage",
            // "snap",  Errors
            "deb",
            "dir"
        ], [
            "x64",
            "armv7l"
        ]),
        desktop: {
            StartupWMClass: "jellyfin-theater"
        }
    },
    win: {
        icon: "icons/icon.ico",
        target: targetConf([
            "nsis",
            "portable",
            "msi",
            "dir"
        ], [
            "x64"
        ])
    },
    deb: {
        depends: [
            ...debDependenyDefault,
            "cec-utils"
        ]
    },
    snap: {
        stagePackages: [
            "default",
            "cec-utils"
        ],
        plugs: [
            "default",
            "block-devices"
        ]
    }
};
