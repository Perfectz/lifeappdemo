import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { OfflineBoundary, aiNetworkRequiredMessage } from "@/components/OfflineBoundary";

describe("OfflineBoundary", () => {
  it("explains that AI requires network access", () => {
    render(<OfflineBoundary featureName="AI Coach" />);

    expect(screen.getByRole("status", { name: "AI Coach offline boundary" })).toBeVisible();
    expect(screen.getByText("AI Coach needs the network")).toBeVisible();
    expect(screen.getByText(aiNetworkRequiredMessage)).toBeVisible();
  });
});
