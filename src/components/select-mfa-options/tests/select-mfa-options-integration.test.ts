import { describe } from "mocha";
import { expect, sinon } from "../../../../test/utils/test-utils.js";
import nock from "nock";
import request from "supertest";
import * as cheerio from "cheerio";
import { PATH_NAMES } from "../../../app.constants.js";
import type { NextFunction, Request, Response } from "express";
import { getPermittedJourneyForPath } from "../../../../test/helpers/session-helper.js";
import { extractCsrfTokenAndCookies } from "../../../../test/helpers/csrf-helper.js";
import esmock from "esmock";

describe("Integration::select-mfa-options", () => {
  let token: string | string[];
  let cookies: string;
  let app: any;

  before(async () => {
    const { createApp } = await esmock(
      "../../../app.js",
      {},
      {
        "../../../middleware/session-middleware.js": {
          validateSessionMiddleware: sinon.fake(function (
            req: Request,
            res: Response,
            next: NextFunction
          ): void {
            res.locals.sessionId = "tDy103saszhcxbQq0-mjdzU854";
            res.locals.clientSessionId = "csy103saszhcxbQq0-mjdzU854";
            res.locals.persistentSessionId = "dips-123456-abc";

            req.session.user = {
              email: "test@test.com",
              journey: getPermittedJourneyForPath(
                PATH_NAMES.GET_SECURITY_CODES
              ),
            };

            next();
          }),
        },
      }
    );

    app = await createApp();

    ({ token, cookies } = extractCsrfTokenAndCookies(
      await request(app).get(PATH_NAMES.GET_SECURITY_CODES)
    ));
  });

  beforeEach(() => {
    nock.cleanAll();
  });

  after(() => {
    sinon.restore();
    app = undefined;
  });

  it("should show the authenticator setup page without an SMS option", async () => {
    const response = await request(app).get(PATH_NAMES.GET_SECURITY_CODES).expect(200);
    expect(response.text).to.contain("Set up an authenticator app");
    expect(response.text).not.to.contain("Text message to a UK mobile phone number");
  });

  it("should return error when csrf not present", async () => {
    await request(app)
      .post(PATH_NAMES.GET_SECURITY_CODES)
      .type("form")
      .send({
        mfaOptions: "SMS",
      })
      .expect(403);
  });

  it("should return validation error when mfa option not selected", async () => {
    await request(app)
      .post(PATH_NAMES.GET_SECURITY_CODES)
      .type("form")
      .set("Cookie", cookies)
      .send({
        _csrf: token,
        mfaOptions: undefined,
      })
      .expect(function (res) {
        const $ = cheerio.load(res.text);
        expect($("#mfaOptions-error").text()).to.contains(
          "Continue with an authenticator app"
        );
      })
      .expect(400);
  });

  it("should redirect to /setup-authenticator-app page when mfaOptions is AUTH_APP", async () => {
    await request(app)
      .post(PATH_NAMES.GET_SECURITY_CODES)
      .type("form")
      .set("Cookie", cookies)
      .send({
        _csrf: token,
        mfaOptions: "AUTH_APP",
      })
      .expect("Location", PATH_NAMES.CREATE_ACCOUNT_SETUP_AUTHENTICATOR_APP)
      .expect(302);
  });

  it("should reject an SMS submission without entering a phone-number journey", async () => {
    await request(app)
      .post(PATH_NAMES.GET_SECURITY_CODES)
      .type("form")
      .set("Cookie", cookies)
      .send({
        _csrf: token,
        mfaOptions: "SMS",
      })
      .expect(function (res) {
        const $ = cheerio.load(res.text);
        expect($("#mfaOptions-error").text()).to.contains(
          "Continue with an authenticator app"
        );
      })
      .expect(400);
  });
});
