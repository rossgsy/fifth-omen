declare module "qrcode" {
    type QrErrorCorrectionLevel = "L" | "M" | "Q" | "H";

    interface QrSvgOptions {
        color?: {
            dark?: string;
            light?: string;
        };
        errorCorrectionLevel?: QrErrorCorrectionLevel;
        margin?: number;
        type?: "svg";
        width?: number;
    }

    const QRCode: {
        toString(text: string, options: QrSvgOptions): Promise<string>;
    };

    export default QRCode;
}
