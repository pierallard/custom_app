const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const strings = require('locutus/php/strings');
const app = express();
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'data.json');
app.use(express.static(path.join(__dirname, 'public')));

app.use(cookieParser());
const port = 3000;

const client_id = '1e47c47b-abcb-4586-ad9d-39344a13ff3d';
const client_secret = 'NDdhN2M4OWEwNTIzYTQxNTA1ZThmZTVkYjRmYWZhY2QzN2M1NGYzMzUwMjMzMTQ1NzRmZTgzYmExNzAxNWIzNA';
const redirectUrl = 'http://172.17.0.1:8080';

const COOKIE_KEY = 'myAccessToken6';
const USERNAME_KEY = 'username';
const COOKIE_REDIRECT_AFTER_AUTHENT = 'redirectAfterAuthent';

function bin2hex(buffer) {
    return Array.prototype.map.call(buffer, x => ('00' + x.toString(16)).slice(-2)).join('');
}

function getUrl(path, params) {
    const urlObject = new URL(`${redirectUrl}${path}`);
    Object.keys(params).forEach(key => urlObject.searchParams.append(key, params[key]));

    return `${urlObject.origin}${urlObject.pathname}${urlObject.search}`;
}

app.disable('etag');

app.get('/activate', (req, res) => {
    console.debug('Call for /activate');
    console.debug(req.params); // This query has no params
    console.debug(req.cookies); // The PIM send "sub", "vector" and "BAPID" in cookies.

    /*
    Admin:
    sub: 'AfzLPTd59nJdOua1HKCJLM9nu6pORS6LBdvvc+K8FGnnGveR',
    vector: '3be4d6a0f793f439308f5c01d7b2ad24',
    BAPID: '2sbj2j5ofam5u7irepcntrjag2',

    Julia:
    sub: 'AfzLPTd59nJdOua1HKCJLM9nu6pORS6LBdvvc+K8FGnnGveR',
    vector: '3be4d6a0f793f439308f5c01d7b2ad24',
    BAPID: '2sbj2j5ofam5u7irepcntrjag2',
    */

    // Call akeneo_connectivity_connection_connect_apps_v1_authorize
    res.redirect(getUrl('/connect/apps/v1/authorize', {
        response_type: 'code',
        client_id,
        scope: 'smart_connect openid',
        state: 'arandomthing',
    }));
});

app.get('/callback', async (req, res) => {
    console.debug('Call for /callback');
    console.debug(req.params);
    console.debug(req.cookies);

    const {code} = req.query;

    const code_identifier = strings.bin2hex(crypto.randomBytes(30));
    const code_challenge = crypto.createHash('sha256').update(code_identifier + client_secret).digest('hex');

    // Call for akeneo_connectivity_connection_connect_apps_v1_token
    console.debug(`Call Akeneo for a token from code ${code}`);
    const response = await axios.post(`${redirectUrl}/connect/apps/v1/oauth2/token`, {
        grant_type: 'authorization_code',
        client_id,
        code,
        code_identifier,
        code_challenge,
    }, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    // The token_type = 'bearer'
    console.debug(response.data);
    const { access_token, token_type, scope, id_token } = response.data;

    console.debug(`Access token received: ${access_token}`);

    const decodedIdToken = jwt.decode(id_token);

    /**
     * {
     *   iss: 'http://172.17.0.1:8080', // Issuer
     *   jti: '75d82c4a-a7ee-4bc0-a89a-bb8a2173215a', // JWT ID
     *   sub: 'a80dd03c-afa5-40f2-8c15-86424127f9f2', // Subject (the user)
     *   aud: '1e47c47b-abcb-4586-ad9d-39344a13ff3d', // This is the client id (the audience)
     *   iat: 1719242987.301493, // Issued at time
     *   exp: 1719246587.301493, // Expiration date
     *   connection_code: 'app_ajzmhuiky3kg4kggc48ogsw0g' // This is the username
     * }
     */

    console.debug('Saving access token into cookie.');
    res.cookie(COOKIE_KEY, access_token, {sameSite: 'none', secure: true});
    res.cookie(USERNAME_KEY, decodedIdToken.connection_code, {sameSite: 'none', secure: true});

    if (req.cookies[COOKIE_REDIRECT_AFTER_AUTHENT]) {
        //res.redirect(req.cookies[COOKIE_REDIRECT_AFTER_AUTHENT]);
        res.cookie(COOKIE_KEY, '', {sameSite: 'none', secure: true});

        const url = new URL(req.cookies[COOKIE_REDIRECT_AFTER_AUTHENT]);
        displayIframe(res, access_token, Object.fromEntries([...url.searchParams]));
    } else {
        res.send(`Access token received for user ${decodedIdToken.connection_code}.`);
    }
});

const displayIframe = async (res, bearer, query) => {
    const {uuid, username} = query;

    try {
        const product = await getProduct(bearer, uuid);
        const name = product.values.name[0].data;

        res.send(`<html lang="en"><head><link rel="stylesheet" href="/style.css"><title>T</title></head><body><button class="AknButton">Go to my website to show ${name}</button></body></html>`);
    } catch (error) {
        res.send(`<html lang="en"><head><link rel="stylesheet" href="/style.css"><title>T</title></head><body>🚫</body></html>`);
    }
}

const getProduct = async (bearer, uuid) => {
    const result = await axios.get(redirectUrl + '/api/rest/v1/products-uuid/' + uuid, {
        headers: {'Authorization': `Bearer ${bearer}`}
    });

    return result.data;
}

app.get('/iframe', async (req, res) => {
    console.debug('Call for /iframe');
    const {uuid, username} = req.query;

    if (req.cookies[COOKIE_KEY] && req.cookies[USERNAME_KEY]) {
        console.debug('Cookies found');
        if (req.cookies[USERNAME_KEY] !== username) {
            console.debug(`User mismatch: ${req.cookies[USERNAME_KEY]} / ${username}`);
        }
    } else {
        console.debug('Cookies not found !');
        console.debug(req.cookies);
    }

    if (req.cookies[COOKIE_KEY] && req.cookies[USERNAME_KEY] && req.cookies[USERNAME_KEY] === username) {
        displayIframe(res, req.cookies[COOKIE_KEY], req.query);
    } else {
        res.cookie(COOKIE_REDIRECT_AFTER_AUTHENT, `http://localhost:3000${req.originalUrl}`, {sameSite: 'none', secure: true});
        res.redirect(getUrl('/connect/apps/v1/authorize', {
            response_type: 'code',
            client_id,
            scope: 'smart_connect openid',
            state: 'arandomthing',
        }));
    }
});

async function getConnectedUsername(req) {
    const result = await axios.get(redirectUrl + '/api/rest/v1/whoami', {
        headers: {'Authorization': `Bearer ${req.cookies[COOKIE_KEY]}`}
    });

    return result.data.username;
}

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});


