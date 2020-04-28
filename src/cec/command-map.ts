/**
 * @packageDocumentation
 * Command Map Module. Maps CEC event codes to Jellyfin commands.
 */

/**
 * Parses CEC event code and converts it into a Jellyfin command.
 * @param code 2 character code.
 */
export function parseCmd(code: string): string | undefined {
    switch (code.toUpperCase()) {
        case "00": // Select
            return "select";
        case "01": // Up
            return "up";
        case "02": // Down
            return "down";
        case "03": // Left
            return "left";
        case "04": // Right
            return "right";
        case "05": // Right-Up
            // return "select";
            break;
        case "06": // Right-Down
            // return "up";
            break;
        case "07": // Left-Up
            // return "down";
            break;
        case "08": // Left-Down
            // return "left";
            break;
        case "09": // Root Menu
            return "menu";
        case "0A": // Setup Menu
            return "settings";
        case "0B": // Contents Menu
            // return "select";
            break;
        case "0C": // Favorite Menu
            return "favorites";
        case "0D": // Exit
            return "back"; // exit is just back

        // 0E to 1F is reserved

        case "20": // 0
            // return "select";
            break;
        case "21": // 1
            // return "up";
            break;
        case "22": // 2
            // return "down";
            break;
        case "23": // 3
            // return "left";
            break;
        case "24": // 4
            // return "right";
            break;
        case "25": // 5
            // return "select";
            break;
        case "26": // 6
            // return "up";
            break;
        case "27": // 7
            // return "down";
            break;
        case "28": // 8
            // return "left";
            break;
        case "29": // 9
            // return "menu";
            break;
        case "2A": // Dot
            // return "menu";
            break;
        case "2B": // Enter
            return "select";
        case "2C": // Clear
            // return "favorites";
            break;

        // 2D to 2E is reserved

        case "2F": // Next Favorite
            // return "back";
            break;

        case "30": // Channel Up
            // return "select";
            break;
        case "31": // Channel Down
            // return "up";
            break;
        case "32": // Previous Channel
            // return "down";
            break;
        case "33": // Sound Select
            // return "left";
            break;
        case "34": // Input Select
            // return "right";
            break;
        case "35": // Display Information
            // return "select";
            break;
        case "36": // Help
            // return "up";
            break;
        case "37": // Page Up
            return "pageup";
        case "38": // Page Down
            return "pagedown";

        // 39 to 3F is reserved

        case "40": // Power
            // return "select";
            break;
        case "41": // Volume Up
            return "volumeup";
        case "42": // Volume Down
            return "volumedown";
        case "43": // Mute
            return "togglemute";
        case "44": // Play
            return "play";
        case "45": // Stop
            return "stop";
        case "46": // Pause
            return "pause";
        case "47": // Record
            return "record";
        case "48": // Rewind
            return "rewind";
        case "49": // Fast Forward
            return "fastforward";
        case "4A": // Eject
            // return "menu";
            break;
        case "4B": // Forward
            return "next";
        case "4C": // Backward
            return "previous";
        case "4D": // Stop-Record
            // return "previous";
            break;
        case "4E": // Pause-Record
            // return "previous";
            break;

        // 4F is reserved

        case "50": // Angle
            // return "select";
            break;
        case "51": // Sub Picture
            // return "volumeup";
            break;
        case "52": // Video On Demand
            // return "volumedown";
            break;
        case "53": // Electronic Program Guide
            return "guide";
        case "54": // Timer Programming
            // return "play";
            break;
        case "55": // Initial Configuration
            // return "stop";
            break;

        // 56 to 5F is reserved

        case "60": // Play Function
            return "play";
        case "61": // Pause-Play Function
            return "playpause";
        case "62": // Record Function
            return "record";
        case "63": // Pause-Record Function
            // return "";
            break;
        case "64": // Stop Function
            return "stop";
        case "65": // Mute Function
            return "togglemute";
        case "66": // Restore Volume Function
            // return "togglemute";
            break;
        case "67": // Tune Function
            // return "togglemute";
            break;
        case "68": // Select Media Function
            // return "togglemute";
            break;
        case "69": // Select A/V Input Function
            // return "togglemute";
            break;
        case "6A": // Select Audio Input Function
            // return "togglemute";
            break;
        case "6B": // Power Toggle Function
            // return "togglemute";
            break;
        case "6C": // Power Off Function
            // return "togglemute";
            break;
        case "6D": // Power On Function
            // return "togglemute";
            break;

        // 6E to 70 is reserved

        case "71": // F1 (Blue)
            // return "playpause";
            break;
        case "72": // F2 (Red)
            // return "record";
            break;
        case "73": // F3 (Green)
            // return "";
            break;
        case "74": // F4 (Yellow)
            // return "stop";
            break;
        case "75": // F5
            // return "togglemute";
            break;
        case "76": // Data
            // return "togglemute;
            break;
    }
}
