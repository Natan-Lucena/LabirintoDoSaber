import { Router } from "express";
import { MockEducatorRepository } from "../../../../infraestructure/repositories/mock/educator-repository-impl";
import { MockStudentRepository } from "../../../../infraestructure/repositories/mock/student-repository-impl";
import { CreateStudentUseCase } from "../use-cases/create-student/create-student-use-case";
import { CreateStudentController } from "../use-cases/create-student/create-student-controller";
import { AssignEducatorUseCase } from "../use-cases/assign-educator/assign-educator-use-case";
import { AssignEducatorController } from "../use-cases/assign-educator/assign-educator-controller";
import { ListStudentsByEducatorUseCase } from "../use-cases/list-students-by-educator/list-students-by-educator-use-case";
import { ListStudentsByEducatorController } from "../use-cases/list-students-by-educator/list-students-by-educator-controller";

const studentRouter = Router();

const educatorRepository = new MockEducatorRepository();
const studentRepository = new MockStudentRepository();

const createStudentUseCase = new CreateStudentUseCase(
  studentRepository,
  educatorRepository
);

const assignEducatorUseCase = new AssignEducatorUseCase(
  studentRepository,
  educatorRepository
);

const listStudentByEducatorUseCase = new ListStudentsByEducatorUseCase(
  studentRepository
);

studentRouter.post("/create", async (req, res) => {
  new CreateStudentController(createStudentUseCase).execute(req, res);
});

studentRouter.post("/assign-educator", async (req, res) => {
  new AssignEducatorController(assignEducatorUseCase).execute(req, res);
});

studentRouter.get("/", async (req, res) => {
  new ListStudentsByEducatorController(listStudentByEducatorUseCase).execute(
    req,
    res
  );
});

export { studentRouter };
