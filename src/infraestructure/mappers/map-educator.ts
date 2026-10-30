import { Educator } from "../../domain/entities/educator";

export const mapEducatorToResponse = (educator: Educator) => {
  return {
    id: educator.id.value,
    name: educator.name,
    email: educator.email,
    photoUrl: educator.photoUrl,
    contact: educator.contact,
    profession: educator.profession,
  };
};
