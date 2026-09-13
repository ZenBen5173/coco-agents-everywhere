/**
 * Agent-rendered components for COCO in Slack.
 *
 * `defineChannelComponent` turns a component into a tool the agent can call to
 * draw UI itself. One tree renders as Slack Block Kit, Teams Adaptive Cards,
 * and Discord components.
 */
import {
  defineChannelComponent,
  Message,
  Header,
  Section,
  Markdown,
  Fields,
  Field,
  Context,
  Divider,
  Actions,
  Button,
  Table,
  Row,
  Cell,
} from "@copilotkit/channels";
import { z } from "zod";

export const ACCENT = "#4F46E5";

/** A list of items or pending captures, as a table the channel can scan. */
export const ItemList = defineChannelComponent({
  name: "item_list",
  description:
    "Draw a list of board items or pending captures as a native table. Use it whenever you answer 'what is late / pending / mine / open' or list more than one thing. Prefer it over prose.",
  parameters: z.object({
    title: z.string().default("Items"),
    rows: z
      .array(
        z.object({
          title: z.string(),
          owner: z.string().describe("Display name, or 'Nobody yet'."),
          due: z.string().describe("As given in the data, e.g. 'Fri 18 Sep' or 'No date'."),
          status: z.string().describe("pending · open · late · done · dropped"),
        }),
      )
      .min(1)
      .max(15),
    footer: z.string().optional().describe("One line, e.g. '3 late · 2 pending review'."),
  }),
  render({ title, rows, footer }) {
    return (
      <Message accent={ACCENT}>
        <Header>{title}</Header>
        <Table columns={[{ header: "What" }, { header: "Who" }, { header: "When" }, { header: "Status" }]}>
          {rows.map((r) => (
            <Row>
              <Cell>{r.title}</Cell>
              <Cell>{r.owner}</Cell>
              <Cell>{r.due}</Cell>
              <Cell>{r.status}</Cell>
            </Row>
          ))}
        </Table>
        {footer && (
          <>
            <Divider />
            <Context>{footer}</Context>
          </>
        )}
      </Message>
    );
  },
});

/** Posted by capture_from_thread once the review queue has new rows. */
export function capturedCard(count: number, titles: string[], reviewUrl: string) {
  return (
    <Message accent={ACCENT}>
      <Header>{count === 0 ? "Nothing new to review" : `${count} thing${count === 1 ? "" : "s"} sent to review`}</Header>
      {titles.length > 0 && (
        <Section>
          <Markdown>{titles.map((t) => `• ${t}`).join("\n")}</Markdown>
        </Section>
      )}
      <Context>Nothing is on the board yet. A human decides on the review page.</Context>
      {count > 0 && (
        <Actions>
          <Button url={reviewUrl} style="primary">
            Open review
          </Button>
        </Actions>
      )}
    </Message>
  );
}

/**
 * The welcome message. A bot that says nothing when invited looks broken; one
 * that says what it will do on its own gets used.
 */
export function welcomeMessage(platform: string) {
  return (
    <Message accent={ACCENT}>
      <Header>COCO is in the room</Header>
      <Section>
        <Markdown>
          {"I keep track of what people in this " +
            platform +
            " channel commit to, decide, and set deadlines for. @-mention me to ask what's pending, what's late, or what you promised."}
        </Markdown>
      </Section>
      <Fields>
        <Field label="I will">Listen, propose, answer</Field>
        <Field label="I won't">Put anything on the board — that takes a human click</Field>
      </Fields>
      <Actions>
        <Button
          value="pending"
          style="primary"
          onClick={async ({ thread }) => {
            await thread.runAgent({ prompt: "What is waiting for review and what is late? Draw an item_list." });
          }}
        >
          What's pending?
        </Button>
      </Actions>
    </Message>
  );
}
