import type { GenerationJob } from "@framebook/shared/contracts/framebook"

export const generationToastId = "generation"
export const promptEnhancementToastId = "prompt-enhancement"

export function isActiveGenerationJob(job: GenerationJob) {
  return job.status === "queued" || job.status === "running"
}

export function activeGenerationJobCount(jobs: Array<GenerationJob>) {
  return jobs.filter(isActiveGenerationJob).length
}

export function generationStartedToastMessage(versionCount: number) {
  return versionCount > 1
    ? `${versionCount} images are being generated`
    : "Your image is being generated"
}

export function generationSucceededToastMessage(succeededCount: number) {
  return succeededCount > 1
    ? `${succeededCount} images generated`
    : "Image generated"
}
