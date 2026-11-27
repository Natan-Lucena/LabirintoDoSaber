import { Router } from "express";
import { CreateStudentUseCase } from "../use-cases/create-student/create-student-use-case";
import { CreateStudentController } from "../use-cases/create-student/create-student-controller";
import { AssignEducatorUseCase } from "../use-cases/assign-educator/assign-educator-use-case";
import { AssignEducatorController } from "../use-cases/assign-educator/assign-educator-controller";
import { ListStudentsByEducatorUseCase } from "../use-cases/list-students-by-educator/list-students-by-educator-use-case";
import { ListStudentsByEducatorController } from "../use-cases/list-students-by-educator/list-students-by-educator-controller";
import { makeAuthMiddleware } from "../../../../infraestructure/middlewares";
import {
  makeAnamneseResponseRepository,
  makeAppointmentRepository,
  makeAppointmentSchedulerService,
  makeClinicMemberRepository,
  makePlanRepository,
  makeScaleApplicationRepository,
  makeSessionEvolutionRepository,
  makeTaskNotebookSessionRepository,
  makeEducatorRepository,
  makeFileStorage,
  makeStudentAccessService,
  makeStudentRepository,
  makeStudentShareRepository,
} from "../../../../infraestructure/factories";
import { Multer } from "../../../../infraestructure/upload/multer-config";
import { UpdateStudentUseCase } from "../use-cases/update-student/update-student-use-case";
import { UpdateStudentController } from "../use-cases/update-student/update-student-controller";
import { AddStudentDocumentUseCase } from "../use-cases/add-student-document/add-student-document-use-case";
import { AddStudentDocumentController } from "../use-cases/add-student-document/add-student-document-controller";
import { ShareStudentUseCase } from "../use-cases/share-student/share-student-use-case";
import { ShareStudentController } from "../use-cases/share-student/share-student-controller";
import { UnshareStudentUseCase } from "../use-cases/unshare-student/unshare-student-use-case";
import { UnshareStudentController } from "../use-cases/unshare-student/unshare-student-controller";
import { ListStudentSharesUseCase } from "../use-cases/list-student-shares/list-student-shares-use-case";
import { ListStudentSharesController } from "../use-cases/list-student-shares/list-student-shares-controller";
import { GetStudentUseCase } from "../use-cases/get-student/get-student-use-case";
import { GetStudentController } from "../use-cases/get-student/get-student-controller";
import { ChangeStudentStatusUseCase } from "../use-cases/change-student-status/change-student-status-use-case";
import { ChangeStudentStatusController } from "../use-cases/change-student-status/change-student-status-controller";
import { GetStudentsOverviewUseCase } from "../use-cases/get-students-overview/get-students-overview-use-case";
import { GetStudentsOverviewController } from "../use-cases/get-students-overview/get-students-overview-controller";

const studentRouter = Router();

const educatorRepository = makeEducatorRepository({ isMock: false });
const studentRepository = makeStudentRepository({ isMock: false });
const studentAccess = makeStudentAccessService();
const shareRepository = makeStudentShareRepository();
const memberRepository = makeClinicMemberRepository();
const appointmentRepository = makeAppointmentRepository();
const schedulerService = makeAppointmentSchedulerService(appointmentRepository);

const fileStorage = makeFileStorage();

const createStudentUseCase = new CreateStudentUseCase(
  studentRepository,
  educatorRepository,
  fileStorage
);

const assignEducatorUseCase = new AssignEducatorUseCase(
  studentAccess,
  studentRepository,
  educatorRepository,
  memberRepository,
  shareRepository
);

const listStudentByEducatorUseCase = new ListStudentsByEducatorUseCase(
  studentAccess,
  educatorRepository
);

const shareStudentUseCase = new ShareStudentUseCase(
  studentAccess,
  shareRepository,
  memberRepository,
  educatorRepository
);

const unshareStudentUseCase = new UnshareStudentUseCase(
  studentAccess,
  shareRepository,
  memberRepository,
  educatorRepository
);

const listStudentSharesUseCase = new ListStudentSharesUseCase(
  studentAccess,
  shareRepository,
  memberRepository,
  educatorRepository
);

const updateStudentUseCase = new UpdateStudentUseCase(
  studentRepository,
  fileStorage,
  educatorRepository
);

const addStudentDocumentUseCase = new AddStudentDocumentUseCase(
  studentRepository,
  educatorRepository,
  fileStorage
);

const getStudentUseCase = new GetStudentUseCase(studentAccess, educatorRepository);

const changeStudentStatusUseCase = new ChangeStudentStatusUseCase(
  studentAccess,
  studentRepository,
  appointmentRepository,
  schedulerService
);

const getStudentsOverviewUseCase = new GetStudentsOverviewUseCase(
  studentAccess,
  appointmentRepository,
  makeTaskNotebookSessionRepository(),
  makeSessionEvolutionRepository(),
  makePlanRepository(),
  makeScaleApplicationRepository(),
  makeAnamneseResponseRepository()
);

const authMiddleware = makeAuthMiddleware(educatorRepository);

studentRouter.use(authMiddleware);

studentRouter.put(
  "/update/:id",
  Multer.getUploader(5).single("photo"),
  async (req, res) => {
    new UpdateStudentController(updateStudentUseCase).execute(req, res);
  }
);

studentRouter.post(
  "/create",
  Multer.getUploader(5).single("photo"),
  async (req, res) => {
    new CreateStudentController(createStudentUseCase).execute(req, res);
  }
);

studentRouter.post(
  "/:id/documents",
  Multer.getUploader(10).single("document"),
  async (req, res) => {
    new AddStudentDocumentController(addStudentDocumentUseCase).execute(
      req,
      res
    );
  }
);

studentRouter.post("/assign-educator", async (req, res) => {
  new AssignEducatorController(assignEducatorUseCase).execute(req, res);
});

// Compartilhamento (EQ-10). As rotas literais (/create, /assign-educator,
// /update/:id) não colidem com /:id/shares.
studentRouter.get("/:id/shares", async (req, res) => {
  new ListStudentSharesController(listStudentSharesUseCase).execute(req, res);
});

studentRouter.post("/:id/shares", async (req, res) => {
  new ShareStudentController(shareStudentUseCase).execute(req, res);
});

studentRouter.delete("/:id/shares/:educatorId", async (req, res) => {
  new UnshareStudentController(unshareStudentUseCase).execute(req, res);
});

studentRouter.get("/", async (req, res) => {
  new ListStudentsByEducatorController(listStudentByEducatorUseCase).execute(
    req,
    res
  );
});

// Antes de /:id, para "overview" não ser lido como id.
studentRouter.get("/overview", async (req, res) => {
  new GetStudentsOverviewController(getStudentsOverviewUseCase).execute(req, res);
});

studentRouter.put("/:id/status", async (req, res) => {
  new ChangeStudentStatusController(changeStudentStatusUseCase).execute(req, res);
});

studentRouter.get("/:id", async (req, res) => {
  new GetStudentController(getStudentUseCase).execute(req, res);
});

export { studentRouter };
