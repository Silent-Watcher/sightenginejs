import FormData from "form-data";
import { createReadStream, existsSync } from "node:fs";
import nfetch from "node-fetch";
import type {
    ClientOptions,
    ImageModerationModels,
    ImageModerationResponse,
} from "./types";
export class SightEngineClient {
    private apiUser: string;
    private apiSecret: string;

    constructor(options: ClientOptions) {
        if (!options.apiUser || !options.apiSecret) {
            throw new TypeError(
                "[SightEngineClient] initialization error: both apiUser and apiSecret are required.",
            );
        }
        this.apiUser = options.apiUser;
        this.apiSecret = options.apiSecret;
    }

    async moderateImageByUrl(
        url: string,
        models: ImageModerationModels[] = ["nudity-2.1"],
    ): Promise<ImageModerationResponse> {
        if (!url) {
            throw new TypeError(
                "[SightEngineClient] image moderation by URL error: image url required",
            );
        }

        try {
            const params = new URLSearchParams({
                url,
                models: models.join(","),
                api_user: this.apiUser,
                api_secret: this.apiSecret,
            });

            const response = await fetch(
                `https://api.sightengine.com/1.0/check.json?${params}`,
                { method: "GET" },
            );

            return await response.json() as ImageModerationResponse;
        } catch (error) {
            throw new Error(
                `[SightEngineClient] url image moderation failed: ${
                    (error as Error).message
                }`,
            );
        }
    }

    async moderateImage(
        path: string,
        models: ImageModerationModels[] = ["nudity-2.1"],
    ): Promise<ImageModerationResponse> {
        if (!existsSync(path)) {
            throw new Error("[SightEngineClient] error: image not found.");
        }
        const stream = createReadStream(path);
        

        const params = new URLSearchParams({
            models: models.join(","),
        });

        const form = new FormData();
        form.append("media", stream);
        form.append("api_user", this.apiUser);
        form.append("api_secret", this.apiSecret);

        const res = await nfetch(
            `https://api.sightengine.com/1.0/check.json?${params}`,
            {
                method: "POST",
                body: form,
                headers: form.getHeaders(),
            },
        );

        const resObj = await res.json() as ImageModerationResponse;
        if (resObj?.error) {
            throw new Error(
                `[SightEngineClient] error(${resObj.error.code}):${resObj.error.message}`,
            );
        }

        return resObj;
    }
}
