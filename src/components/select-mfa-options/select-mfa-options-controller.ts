import type { Request, Response } from "express";
import { getNextPathAndUpdateJourney } from "../common/state-machine/state-machine-executor.js";
import { USER_JOURNEY_EVENTS } from "../common/state-machine/state-machine.js";
import { generateMfaSecret } from "../../utils/mfa.js";
import { MFA_METHOD_TYPE } from "../../app.constants.js";
import { isAccountRecoveryJourney } from "../../utils/request.js";

export function getSecurityCodesGet(req: Request, res: Response): void {
  const accountRecoveryJourney = isAccountRecoveryJourney(req);
  req.session.user.isAccountCreationJourney =
    !accountRecoveryJourney || req.session.user.isAccountPartCreated;

  res.render("select-mfa-options/index.njk", {
    isAccountPartCreated: req.session.user.isAccountPartCreated,
    isAccountRecoveryJourney: accountRecoveryJourney,
  });
}

export async function getSecurityCodesPost(
  req: Request,
  res: Response
): Promise<void> {
  if (req.body.mfaOptions !== MFA_METHOD_TYPE.AUTH_APP) {
    res.status(400).send("Unsupported security method");
    return;
  }

  req.session.user.selectedMfaOption = MFA_METHOD_TYPE.AUTH_APP;
  req.session.user.authAppSecret = generateMfaSecret();

  res.redirect(
    await getNextPathAndUpdateJourney(
      req,
      res,
      USER_JOURNEY_EVENTS.MFA_OPTION_AUTH_APP_SELECTED
    )
  );
}
