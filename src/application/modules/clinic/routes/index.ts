import { Router } from "express";
import {
  makeClinicDepartureService,
  makeClinicInviteRepository,
  makeClinicMemberRepository,
  makeClinicRepository,
  makeEducatorRepository,
  makeRateLimitRepository,
} from "../../../../infraestructure/factories";
import { makeAuthMiddleware } from "../../../../infraestructure/middlewares";
import { CreateClinicUseCase } from "../use-cases/create-clinic/create-clinic-use-case";
import { CreateClinicController } from "../use-cases/create-clinic/create-clinic-controller";
import { GetClinicUseCase } from "../use-cases/get-clinic/get-clinic-use-case";
import { GetClinicController } from "../use-cases/get-clinic/get-clinic-controller";
import { UpdateClinicUseCase } from "../use-cases/update-clinic/update-clinic-use-case";
import { UpdateClinicController } from "../use-cases/update-clinic/update-clinic-controller";
import { CreateClinicInviteUseCase } from "../use-cases/create-clinic-invite/create-clinic-invite-use-case";
import { CreateClinicInviteController } from "../use-cases/create-clinic-invite/create-clinic-invite-controller";
import { ListClinicInvitesUseCase } from "../use-cases/list-clinic-invites/list-clinic-invites-use-case";
import { ListClinicInvitesController } from "../use-cases/list-clinic-invites/list-clinic-invites-controller";
import { RevokeClinicInviteUseCase } from "../use-cases/revoke-clinic-invite/revoke-clinic-invite-use-case";
import { RevokeClinicInviteController } from "../use-cases/revoke-clinic-invite/revoke-clinic-invite-controller";
import { PreviewClinicInviteUseCase } from "../use-cases/preview-clinic-invite/preview-clinic-invite-use-case";
import { PreviewClinicInviteController } from "../use-cases/preview-clinic-invite/preview-clinic-invite-controller";
import { AcceptClinicInviteUseCase } from "../use-cases/accept-clinic-invite/accept-clinic-invite-use-case";
import { AcceptClinicInviteController } from "../use-cases/accept-clinic-invite/accept-clinic-invite-controller";
import { UpdateClinicMemberRoleUseCase } from "../use-cases/update-clinic-member-role/update-clinic-member-role-use-case";
import { UpdateClinicMemberRoleController } from "../use-cases/update-clinic-member-role/update-clinic-member-role-controller";
import { RemoveClinicMemberUseCase } from "../use-cases/remove-clinic-member/remove-clinic-member-use-case";
import { RemoveClinicMemberController } from "../use-cases/remove-clinic-member/remove-clinic-member-controller";

const clinicRouter = Router();

const educatorRepository = makeEducatorRepository({ isMock: false });
const clinicRepository = makeClinicRepository();
const memberRepository = makeClinicMemberRepository();
const inviteRepository = makeClinicInviteRepository();

const createClinicUseCase = new CreateClinicUseCase(
  clinicRepository,
  memberRepository,
  educatorRepository
);
const getClinicUseCase = new GetClinicUseCase(clinicRepository, memberRepository, educatorRepository);
const updateClinicUseCase = new UpdateClinicUseCase(
  clinicRepository,
  memberRepository,
  educatorRepository
);
const createClinicInviteUseCase = new CreateClinicInviteUseCase(
  clinicRepository,
  memberRepository,
  inviteRepository
);
const listClinicInvitesUseCase = new ListClinicInvitesUseCase(
  clinicRepository,
  memberRepository,
  inviteRepository
);
const revokeClinicInviteUseCase = new RevokeClinicInviteUseCase(memberRepository, inviteRepository);
const previewClinicInviteUseCase = new PreviewClinicInviteUseCase(
  inviteRepository,
  clinicRepository,
  makeRateLimitRepository()
);
const acceptClinicInviteUseCase = new AcceptClinicInviteUseCase(
  clinicRepository,
  memberRepository,
  inviteRepository,
  educatorRepository
);
const updateClinicMemberRoleUseCase = new UpdateClinicMemberRoleUseCase(
  clinicRepository,
  memberRepository,
  educatorRepository
);
const removeClinicMemberUseCase = new RemoveClinicMemberUseCase(
  memberRepository,
  makeClinicDepartureService()
);

const authMiddleware = makeAuthMiddleware(educatorRepository);

// Pública (EQ-07), com limite por IP: antes do authMiddleware.
clinicRouter.get("/invites/preview/:code", async (req, res) => {
  new PreviewClinicInviteController(previewClinicInviteUseCase).execute(req, res);
});

clinicRouter.use(authMiddleware);

clinicRouter.post("/", async (req, res) => {
  new CreateClinicController(createClinicUseCase).execute(req, res);
});

clinicRouter.get("/", async (req, res) => {
  new GetClinicController(getClinicUseCase).execute(req, res);
});

clinicRouter.put("/", async (req, res) => {
  new UpdateClinicController(updateClinicUseCase).execute(req, res);
});

// Rotas literais antes de /invites/:id.
clinicRouter.post("/invites/accept", async (req, res) => {
  new AcceptClinicInviteController(acceptClinicInviteUseCase).execute(req, res);
});

clinicRouter.post("/invites", async (req, res) => {
  new CreateClinicInviteController(createClinicInviteUseCase).execute(req, res);
});

clinicRouter.get("/invites", async (req, res) => {
  new ListClinicInvitesController(listClinicInvitesUseCase).execute(req, res);
});

clinicRouter.delete("/invites/:id", async (req, res) => {
  new RevokeClinicInviteController(revokeClinicInviteUseCase).execute(req, res);
});

clinicRouter.put("/members/:educatorId", async (req, res) => {
  new UpdateClinicMemberRoleController(updateClinicMemberRoleUseCase).execute(req, res);
});

// O próprio id = sair da clínica.
clinicRouter.delete("/members/:educatorId", async (req, res) => {
  new RemoveClinicMemberController(removeClinicMemberUseCase).execute(req, res);
});

export { clinicRouter };
