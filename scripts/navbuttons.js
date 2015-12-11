require(['inputmanager'], function (inputmanager) {

    function sendCommand(name) {

        inputmanager.handle(name);
    }

    window.addEventListener('keydown', function (e) {

        switch (e.keyCode) {

            case 37:
                // alt-left
                if (e.altKey) {
                    // control
                    e.preventDefault();
                    sendCommand('back');
                    return;
                }
                break;
            case 39:
                // alt-right
                if (e.altKey) {
                    // control
                    e.preventDefault();
                    sendCommand('forward');
                    return;
                }
                break;
            case 8:
                // backspace
                e.preventDefault();
                sendCommand('back');
                break;
            default:
                break;
        }

    });
});