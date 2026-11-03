import { z } from 'zod'

export const CreateProject = z.object({
    project_type: z.enum(["brand_representative", "consultant"], {
        message: "Please select a project type",
    }),
    project_name: z
        .string()
        .min(4, "Project title must be at least 4 characters")
        .max(50, "Project title must be 50 characters or fewer"),
    description: z
        .string()
        .min(4, "Project description must be at least 4 characters")
        .max(50, "Project description must be 50 characters or fewer"),
})

export type CreateProjectForm = z.infer<typeof CreateProject>

export const UpdateProject = z.object({
    project_name: z
        .string()
        .min(2, "Project title must be at least 2 characters")
        .max(150, "Project title must be 150 characters or fewer"),
    description: z
        .string()
        .max(150, "Project description must be 150 characters or fewer")
        .optional(),
})

export type UpdateProjectForm = z.infer<typeof UpdateProject>
