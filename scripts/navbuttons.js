require(['inputmanager'], function (inputmanager) {

    function sendCommand(name) {

        inputmanager.handle(name);
    }

    function parentWithTag(elem, tagName) {

        while (elem.tagName != tagName) {
            elem = elem.parentNode;

            if (!elem) {
                return null;
            }
        }

        return elem;
    }

    function isEditable(elem) {

        if (elem.readonly) {
            return false;
        }
        if (parentWithTag(elem, 'EMBY-DROPDOWN-MENU')) {
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