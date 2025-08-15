import { SightEngineClient } from "./client";

const sightengine = new SightEngineClient({
    apiSecret: "n2zerzixSM5WvDJtaFogDdiEBgZkezh9",
    apiUser: "67854160",
});

const nsfwImage = 'https://tse1.explicit.bing.net/th/id/OIP.2bTJX_6uvPc-fvoPm41t6gHaLF?rs=1&pid=ImgDetMain&o=7&rm=3'

sightengine.moderateImageByUrl(nsfwImage)