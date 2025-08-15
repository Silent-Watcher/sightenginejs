export type ImageModerationModels =
    | "nudity-2.1"
    | "weapon"
    | "alcohol"
    | "recreational_drug"
    | "medical"
    | "type"
    | "quality"
    | "offensive-2.0"
    | "faces"
    | "text"
    | "qr-content"
    | "tobacco"
    | "genai"
    | "violence"
    | "self-harm"
    | "money"
    | "gambling"
    | "text-content"
    | "face-attributes"
    | "gore-2.0"
    | "scam";

export interface ClientOptions {
    apiUser: string;
    apiSecret: string;
}

export interface RequestMetadata {
    id: string;
    timestamp: number;
    operations: number;
}

export interface ImageModerationResponse {
    status: "success" | "failure";
    request: RequestMetadata;
    media: { id: string; uri: string };
    [model: string]: unknown;
}
