import { request } from "node:https";
import { rootCertificates } from "node:tls";

/**
 * Public DigiCert intermediate currently used by mc.gov.sa.
 * Fingerprint (SHA-256):
 * C8:02:5F:9F:C6:5F:DF:C9:5B:3C:A8:CC:78:67:B9:A5:87:B5:27:79:73:95:79:17:46:3F:C8:13:D0:B6:25:A9
 *
 * It is bundled because mc.gov.sa does not currently send the full intermediate
 * chain to Node clients. TLS verification remains enabled; this is NOT a
 * rejectUnauthorized=false workaround.
 */
export const DIGICERT_GLOBAL_G2_TLS_RSA_SHA256_2020_CA1 = `-----BEGIN CERTIFICATE-----
MIIEyDCCA7CgAwIBAgIQDPW9BitWAvR6uFAsI8zwZjANBgkqhkiG9w0BAQsFADBh
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBH
MjAeFw0yMTAzMzAwMDAwMDBaFw0zMTAzMjkyMzU5NTlaMFkxCzAJBgNVBAYTAlVT
MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxMzAxBgNVBAMTKkRpZ2lDZXJ0IEdsb2Jh
bCBHMiBUTFMgUlNBIFNIQTI1NiAyMDIwIENBMTCCASIwDQYJKoZIhvcNAQEBBQAD
ggEPADCCAQoCggEBAMz3EGJPprtjb+2QUlbFbSd7ehJWivH0+dbn4Y+9lavyYEEV
cNsSAPonCrVXOFt9slGTcZUOakGUWzUb+nv6u8W+JDD+Vu/E832X4xT1FE3LpxDy
FuqrIvAxIhFhaZAmunjZlx/jfWardUSVc8is/+9dCopZQ+GssjoP80j812s3wWPc
3kbW20X+fSP9kOhRBx5Ro1/tSUZUfyyIxfQTnJcVPAPooTncaQwywa8WV0yUR0J8
osicfebUTVSvQpmowQTCd5zWSOTOEeAqgJnwQ3DPP3Zr0UxJqyRewg2C/Uaoq2yT
zGJSQnWS+Jr6Xl6ysGHlHx+5fwmY6D36g39HaaECAwEAAaOCAYIwggF+MBIGA1Ud
EwEB/wQIMAYBAf8CAQAwHQYDVR0OBBYEFHSFgMBmx9833s+9KTeqAx2+7c0XMB8G
A1UdIwQYMBaAFE4iVCAYlebjbuYP+vq5Eu0GF485MA4GA1UdDwEB/wQEAwIBhjAd
BgNVHSUEFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwdgYIKwYBBQUHAQEEajBoMCQG
CCsGAQUFBzABhhhodHRwOi8vb2NzcC5kaWdpY2VydC5jb20wQAYIKwYBBQUHMAKG
NGh0dHA6Ly9jYWNlcnRzLmRpZ2ljZXJ0LmNvbS9EaWdpQ2VydEdsb2JhbFJvb3RH
Mi5jcnQwQgYDVR0fBDswOTA3oDWgM4YxaHR0cDovL2NybDMuZGlnaWNlcnQuY29t
L0RpZ2lDZXJ0R2xvYmFsUm9vdEcyLmNybDA9BgNVHSAENjA0MAsGCWCGSAGG/WwC
ATAHBgVngQwBATAIBgZngQwBAgEwCAYGZ4EMAQICMAgGBmeBDAECAzANBgkqhkiG
9w0BAQsFAAOCAQEAkPFwyyiXaZd8dP3A+iZ7U6utzWX9upwGnIrXWkOH7U1MVl+t
wcW1BSAuWdH/SvWgKtiwla3JLko716f2b4gp/DA/JIS7w7d7kwcsr4drdjPtAFVS
slme5LnQ89/nD/7d+MS5EHKBCQRfz5eeLjJ1js+aWNJXMX43AYGyZm0pGrFmCW3R
bpD0ufovARTFXFZkAdl9h6g4U5+LXUZtXMYnhIHUfoyMo5tS58aI7Dd8KvvwVVo4
chDYABPPTHPbqjc1qCmBaZx2vN4Ye5DUys/vZwP9BFohFrH/6j/f3IL16/RZkiMN
JCqVJUzKoZHm1Lesh3Sz8W2jmdv51b2EQJ8HmA==
-----END CERTIFICATE-----`;

const ALLOWED_HOST = "mc.gov.sa";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export async function ministryCommerceGetJson<T>(url: URL, signal?: AbortSignal): Promise<T> {
  if (url.protocol !== "https:" || url.hostname !== ALLOWED_HOST || url.port) {
    throw new Error("Ministry of Commerce transport rejected an unapproved endpoint.");
  }

  return await new Promise<T>((resolve, reject) => {
    const req = request(
      {
        protocol: "https:",
        hostname: ALLOWED_HOST,
        port: 443,
        method: "GET",
        path: `${url.pathname}${url.search}`,
        servername: ALLOWED_HOST,
        rejectUnauthorized: true,
        ca: [...rootCertificates, DIGICERT_GLOBAL_G2_TLS_RSA_SHA256_2020_CA1],
        signal,
        timeout: 15_000,
        headers: {
          accept: "application/json;odata=nometadata, application/json",
          "user-agent": "Hakeem-Due-Diligence/0.1 (official-open-data-client)",
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          response.resume();
          reject(new Error(`Ministry of Commerce returned an unexpected redirect (${status}).`));
          return;
        }
        if (status < 200 || status >= 300) {
          response.resume();
          reject(new Error(`Ministry of Commerce returned HTTP ${status}.`));
          return;
        }

        const contentType = String(response.headers["content-type"] ?? "").toLowerCase();
        if (!contentType.includes("json")) {
          response.resume();
          reject(new Error("Ministry of Commerce returned a non-JSON response."));
          return;
        }

        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          bytes += buffer.length;
          if (bytes > MAX_RESPONSE_BYTES) {
            response.destroy(new Error("Ministry of Commerce response exceeded the size limit."));
            return;
          }
          chunks.push(buffer);
        });
        response.on("error", reject);
        response.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as T);
          } catch {
            reject(new Error("Ministry of Commerce returned invalid JSON."));
          }
        });
      }
    );

    req.on("timeout", () => req.destroy(new Error("Ministry of Commerce request timed out.")));
    req.on("error", reject);
    req.end();
  });
}
