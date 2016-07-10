/**
 * Command Map Module. Maps CEC event codes to Emby commands.
 */

var cecEmitter;

function emitCmd(cmd) {
    cecEmitter.emit("receive-cmd", cmd);
}

/**
 * Parses CEC event code and converts it into an Emby command.
 * @param {String} code - 2 character code.
 * @param {Event.Emitter} emitter - Event emitter.
 */
function parseCmd(code, emitter) {
    cecEmitter = emitter;
    switch(code.toUpperCase()) {
        case "00":  // Select
            emitCmd("select");
            break;
        case "01":  // Up
            emitCmd("up");
            break;
        case "02":  // Down
            emitCmd("down");
            break;
        case "03":  // Left
            emitCmd("left");
            break;
        case "04":  // Right
            emitCmd("right");
            break;
        case "05":  // Right-Up
            // emitCmd("select");
            break;
        case "06":  // Right-Down
            // emitCmd("up");
            break;
        case "07":  // Left-Up
            // emitCmd("down");
            break;
        case "08":  // Left-Down
            // emitCmd("left");
            break;
        case "09":  // Root Menu
            emitCmd("menu");
            break;
        case "0A":  // Setup Menu
            emitCmd("settings");
            break;
        case "0B":  // Contents Menu
            // emitCmd("select");
            break;
        case "0C":  // Favorite Menu
            emitCmd("favorites");
            break;
        case "0D":  // Exit
            emitCmd("back");    // exit is just back
            break;

        // 0E to 1F is reserved

        case "20":  // 0
            // emitCmd("select");
            break;
        case "21":  // 1
            // emitCmd("up");
            break;
        case "22":  // 2
            // emitCmd("down");
            break;
        case "23":  // 3
            // emitCmd("left");
            break;
        case "24":  // 4
            // emitCmd("right");
            break;
        case "25":  // 5
            // emitCmd("select");
            break;
        case "26":  // 6
            // emitCmd("up");
            break;
        case "27":  // 7
            // emitCmd("down");
            break;
        case "28":  // 8
            // emitCmd("left");
            break;
        case "29":  // 9
            // emitCmd("menu");
            break;
        case "2A":  // Dot
            // emitCmd("menu");
            break;
        case "2B":  // Enter
            emitCmd("select");
            break;
        case "2C":  // Clear
            // emitCmd("favorites");
            break;

        // 2D to 2E is reserved

        case "2F":  // Next Favorite
            // emitCmd("back");
            break;

        case "30":  // Channel Up
            // emitCmd("select");
            break;
        case "31":  // Channel Down
            // emitCmd("up");
            break;
        case "32":  // Previous Channel
            // emitCmd("down");
            break;
        case "33":  // Sound Select
            // emitCmd("left");
            break;
        case "34":  // Input Select
            // emitCmd("right");
            break;
        case "35":  // Display Information
            // emitCmd("select");
            break;
        case "36":  // Help
            // emitCmd("up");
            break;
        case "37":  // Page Up
            emitCmd("pageup");
            break;
        case "38":  // Page Down
            emitCmd("pagedown");
            break;
        
        // 39 to 3F is reserved

        case "40":  // Power
            // emitCmd("select");
            break;
        case "41":  // Volume Up
            emitCmd("volumeup");
            break;
        case "42":  // Volume Down
            emitCmd("volumedown");
            break;
        case "43":  // Mute
            emitCmd("togglemute");
            break;
        case "44":  // Play
            emitCmd("play");
            break;
        case "45":  // Stop
            emitCmd("stop");
            break;
        case "46":  // Pause
            emitCmd("pause");
            break;
        case "47":  // Record
            emitCmd("record");
            break;
        case "48":  // Rewind
            emitCmd("rewind");
            break;
        case "49":  // Fast Forward
            emitCmd("fastforward");
            break;
        case "4A":  // Eject
            // emitCmd("menu");
            break;
        case "4B":  // Forward
            emitCmd("next");
            break;
        case "4C":  // Backward
            emitCmd("previous");
            break;
        case "4D":  // Stop-Record
            // emitCmd("previous");
            break;
        case "4E":  // Pause-Record
            // emitCmd("previous");
            break;

        // 4F is reserved

        case "50":  // Angle
            // emitCmd("select");
            break;
        case "51":  // Sub Picture
            // emitCmd("volumeup");
            break;
        case "52":  // Video On Demand
            // emitCmd("volumedown");
            break;
        case "53":  // Electronic Program Guide
            emitCmd("guide");
            break;
        case "54":  // Timer Programming
            // emitCmd("play");
            break;
        case "55":  // Initial Configuration
            // emitCmd("stop");
            break;

        // 56 to 5F is reserved

        case "60":  // Play Function
            emitCmd("play");
            break;
        case "61":  // Pause-Play Function
            emitCmd("playpause");
            break;
        case "62":  // Record Function
            emitCmd("record");
            break;
        case "63":  // Pause-Record Function
            // emitCmd("");
            break;
        case "64":  // Stop Function
            emitCmd("stop");
            break;
        case "65":  // Mute Function
            emitCmd("togglemute");
            break;
        case "66":  // Restore Volume Function
            // emitCmd("togglemute");
            break;
        case "67":  // Tune Function
            // emitCmd("togglemute");
            break;
        case "68":  // Select Media Function
            // emitCmd("togglemute");
            break;
        case "69":  // Select A/V Input Function
            // emitCmd("togglemute");
            break;
        case "6A":  // Select Audio Input Function
            // emitCmd("togglemute");
            break;
        case "6B":  // Power Toggle Function
            // emitCmd("togglemute");
            break;
        case "6C":  // Power Off Function
            // emitCmd("togglemute");
            break;
        case "6D":  // Power On Function
            // emitCmd("togglemute");
            break;

        // 6E to 70 is reserved

        case "71":  // F1 (Blue)
            // emitCmd("playpause");
            break;
        case "72":  // F2 (Red)
            // emitCmd("record");
            break;
        case "73":  // F3 (Green)
            // emitCmd("");
            break;
        case "74":  // F4 (Yellow)
            // emitCmd("stop");
            break;
        case "75":  // F5
            // emitCmd("togglemute");
            break;
        case "76":  // Data
            // emitCmd("togglemute");
            break;
    }
}

module.exports = parseCmd;