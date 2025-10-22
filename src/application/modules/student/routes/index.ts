import { Router } from "express";
import { MockEducatorRepository } from "../../../../infraestructure/repositories/mock/educator-repository-impl";
import { MockStudentRepository } from "../../../../infraestructure/repositories/mock/student-repository-impl";
import { CreateStudentUseCase } from "../use-cases/create-student/create-student-use-case";
import { CreateStudentController } from "../use-cases/create-student/create-student-controller";

const studentRouter = Router();

const educatorRepository = new MockEducatorRepository();
const studentRepository = new MockStudentRepository();

const createStudentUseCase = new CreateStudentUseCase(
  studentRepository,
  educatorRepository
);

const createStudentController = new CreateStudentController(
  createStudentUseCase
);

studentRouter.post("/create", async (req, res) => {
  await createStudentController.execute(req, res);
});

export { studentRouter };
