const encoder = new TextEncoder();

export async function createSignedSessionCookie(options: {
	cookieName: string;
	secret: string;
	sessionId: string;
	secure: boolean;
	maxAgeSeconds?: number;
}) {
	const signature = await signValue(options.secret, options.sessionId);
	const value = `${options.sessionId}.${signature}`;
	const segments = [
		`${options.cookieName}=${value}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		`Max-Age=${options.maxAgeSeconds ?? 60 * 60 * 24 * 30}`,
	];

	if (options.secure) {
		segments.push("Secure");
	}

	return segments.join("; ");
}

export function createExpiredSessionCookie(options: {
	cookieName: string;
	secure: boolean;
}) {
	const segments = [
		`${options.cookieName}=`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		"Max-Age=0",
	];

	if (options.secure) {
		segments.push("Secure");
	}

	return segments.join("; ");
}

export async function verifySignedSessionCookie(options: {
	cookieName: string;
	secret: string;
	request: Request;
}) {
	const cookie = getCookie(options.request, options.cookieName);

	if (!cookie) {
		return null;
	}

	const [sessionId, signature] = cookie.split(".");

	if (!sessionId || !signature) {
		return null;
	}

	const expected = await signValue(options.secret, sessionId);
	return timingSafeEqual(expected, signature) ? sessionId : null;
}

function getCookie(request: Request, name: string) {
	const cookieHeader = request.headers.get("Cookie");

	if (!cookieHeader) {
		return null;
	}

	for (const segment of cookieHeader.split(";")) {
		const [rawName, ...rest] = segment.trim().split("=");
		if (rawName === name) {
			return rest.join("=");
		}
	}

	return null;
}

async function signValue(secret: string, value: string) {
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));

	return toBase64Url(signature);
}

function toBase64Url(value: ArrayBuffer) {
	const bytes = new Uint8Array(value);
	let binary = "";

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function timingSafeEqual(left: string, right: string) {
	if (left.length !== right.length) {
		return false;
	}

	let mismatch = 0;
	for (let index = 0; index < left.length; index += 1) {
		mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}

	return mismatch === 0;
}
