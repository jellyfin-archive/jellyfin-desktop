require(['inputmanager'], function (inputmanager) {

    function sendCommand(name) {

        inputmanager.handle(name);
    }

    function isEditable(elem) {

        if (elem.readonly) {
            return false;
        }
        return elem.tagName == 'INPUT';
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
                if (!isEditable(e.target)) {
                    e.preventDefault();
                    sendCommand('back');
                }
                break;
            default:
                break;
        }

    });
});