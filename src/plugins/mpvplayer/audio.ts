define(["loading", "appSettings", "emby-select", "emby-checkbox", "emby-scroller"], function (loading, appSettings) {
    function getMultiCheckboxValues(view: HTMLElement, className: string): string[] {
        const checkboxes: NodeListOf<HTMLInputElement> = view.querySelectorAll(`.${className}`);
        const values = [];

        for (let i = 0, length = checkboxes.length; i < length; i++) {
            if (checkboxes[i].checked) {
                values.push(checkboxes[i].getAttribute("data-value"));
            }
        }

        return values;
    }

    function setMultiCheckboxValues(view: HTMLElement, className: string, values: string): void {
        const valList = values.split(",");
        const checkboxes: NodeListOf<HTMLInputElement> = view.querySelectorAll(`.${className}`);

        for (let i = 0, length = checkboxes.length; i < length; i++) {
            checkboxes[i].checked = valList.includes(checkboxes[i].getAttribute("data-value"));
        }
    }

    function onSubmit(e): false {
        e.preventDefault();
        return false;
    }

    return function (view): void {
        view.querySelector("form").addEventListener("submit", onSubmit);

        view.addEventListener("viewbeforeshow", function (e) {
            const isRestored = e.detail.isRestored;

            window["Emby"].Page.setTitle("Audio Settings");

            loading.hide();

            if (!isRestored) {
                renderSettings();
            }
        });

        view.addEventListener("viewbeforehide", saveSettings);

        function saveSettings(): void {
            appSettings.set("mpv-drc", view.querySelector(".selectDrc").value);
            appSettings.set("mpv-speakerlayout", view.querySelector(".selectSpeakerLayout").value);
            appSettings.set("mpv-exclusiveAudio", view.querySelector(".chkExclusiveMode").checked);

            appSettings.set("mpv-audiospdif", getMultiCheckboxValues(view, "chkSpdif").join(","));
            appSettings.set("mpv-upmixaudiofor", getMultiCheckboxValues(view, "chkUpmixAudioFor").join(","));
        }

        function renderSettings(): void {
            view.querySelector(".selectSpeakerLayout").value = appSettings.get("mpv-speakerlayout") || "";
            view.querySelector(".selectDrc").value = appSettings.get("mpv-drc") || "";
            view.querySelector(".chkExclusiveMode").checked = appSettings.get("mpv-exclusiveAudio") === "true";

            setMultiCheckboxValues(view, "chkSpdif", appSettings.get("mpv-audiospdif") || "");
            setMultiCheckboxValues(view, "chkUpmixAudioFor", appSettings.get("mpv-upmixaudiofor") || "");
        }
    };
});
