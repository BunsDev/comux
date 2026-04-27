import { describe, it, expect } from "vitest"
import {
  isActiveDevSourcePath,
  resolveNextDevSourcePath,
} from "../src/utils/devSource.js"

describe("devSource utils", () => {
  it("detects active source path match", () => {
    expect(
      isActiveDevSourcePath(
        "/repo/.comux/worktrees/feature-a",
        "/repo/.comux/worktrees/feature-a"
      )
    ).toBe(true)
  })

  it("returns false when pane has no worktree path", () => {
    expect(
      isActiveDevSourcePath(undefined, "/repo/.comux/worktrees/feature-a")
    ).toBe(false)
  })

  it("resolves to selected worktree when switching source", () => {
    const result = resolveNextDevSourcePath(
      "/repo/.comux/worktrees/feature-b",
      "/repo/.comux/worktrees/feature-a",
      "/repo"
    )

    expect(result).toEqual({
      nextSourcePath: "/repo/.comux/worktrees/feature-b",
      toggledToRoot: false,
    })
  })

  it("toggles back to root when selecting active source", () => {
    const result = resolveNextDevSourcePath(
      "/repo/.comux/worktrees/feature-a",
      "/repo/.comux/worktrees/feature-a",
      "/repo"
    )

    expect(result).toEqual({
      nextSourcePath: "/repo",
      toggledToRoot: true,
    })
  })
})
