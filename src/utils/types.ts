export type JsonPrimitiveValue = null | number | string | boolean;
export type JsonSingleValue = JsonPrimitiveValue | JsonObject;
export type JsonValue = JsonSingleValue | JsonSingleValue[];

export interface JsonObject {
    [key: string]: JsonValue;
}

export type WindowState = "Normal" | "Minimized" | "Maximized" | "Fullscreen";
