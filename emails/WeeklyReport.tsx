import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

import { BRAND_COLORS, BRAND_NAME, formatPrice } from "./shared";

export type TopProductEmailRow = {
  name: string;
  unitsSold: number;
  revenue: number;
};

export type LowStockEmailRow = {
  name: string;
  stockQuantity: number;
  lowStockThreshold: number;
};

export type WeeklyReportEmailProps = {
  weekLabel: string;
  revenue: number;
  previousRevenue: number;
  revenueGrowthPercent: number;
  orderCount: number;
  previousOrderCount: number;
  bestSellers: TopProductEmailRow[];
  lowStock: LowStockEmailRow[];
  aiInsight: string;
};

const { plum, plumDark, plumLight, ivory, charcoal, muted, white, border } =
  BRAND_COLORS;

function growthLabel(percent: number): string {
  if (percent > 0) return `+${percent.toFixed(0)}%`;
  if (percent < 0) return `${percent.toFixed(0)}%`;
  return "No change";
}

function statBlock(label: string, value: string) {
  return (
    <Row
      style={{
        display: "block",
        padding: "16px 0",
        borderBottom: `1px solid ${border}`,
      }}
    >
      <Text
        style={{
          margin: 0,
          fontSize: 12,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: muted,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          margin: "4px 0 0",
          fontSize: 24,
          fontWeight: 600,
          color: charcoal,
        }}
      >
        {value}
      </Text>
    </Row>
  );
}

export default function WeeklyReportEmail({
  weekLabel,
  revenue,
  previousRevenue,
  revenueGrowthPercent,
  orderCount,
  previousOrderCount,
  bestSellers,
  lowStock,
  aiInsight,
}: WeeklyReportEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`${BRAND_NAME} weekly business report — ${weekLabel}`}</Preview>
      <Body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: ivory,
          fontFamily: "'Georgia', 'Times New Roman', serif",
        }}
      >
        <Container
          style={{
            maxWidth: 560,
            margin: "0 auto",
            padding: "24px 16px",
          }}
        >
          {/* Masthead */}
          <Section
            style={{
              backgroundColor: plum,
              borderRadius: 12,
              padding: "28px 32px",
            }}
          >
            <Text
              style={{
                margin: 0,
                color: white,
                fontSize: 22,
                letterSpacing: "0.04em",
                fontWeight: 600,
              }}
            >
              {BRAND_NAME}
            </Text>
            <Text
              style={{
                margin: "6px 0 0",
                color: "#c9a9c4",
                fontSize: 13,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Weekly Business Report
            </Text>
          </Section>

          {/* Heading */}
          <Section
            style={{
              backgroundColor: white,
              borderRadius: 12,
              padding: "28px 32px",
              marginTop: 16,
            }}
          >
            <Heading
              as="h1"
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 600,
                color: plumDark,
              }}
            >
              {weekLabel}
            </Heading>
            <Text
              style={{
                margin: "8px 0 0",
                fontSize: 14,
                lineHeight: "1.6",
                color: charcoal,
              }}
            >
              {aiInsight}
            </Text>
          </Section>

          {/* Key numbers */}
          <Section
            style={{
              backgroundColor: white,
              borderRadius: 12,
              padding: "8px 32px",
              marginTop: 16,
            }}
          >
            {statBlock("Revenue (This Week)", formatPrice(revenue))}
            {statBlock(
              "Revenue vs Previous Week",
              `${growthLabel(revenueGrowthPercent)} · ${formatPrice(previousRevenue)}`,
            )}
            {statBlock("Orders", String(orderCount))}
            {statBlock(
              "Orders vs Previous Week",
              `${previousOrderCount > 0 ? (((orderCount - previousOrderCount) / previousOrderCount) * 100 >= 0 ? "+" : "") : "+"}${previousOrderCount > 0 ? Number(((orderCount - previousOrderCount) / previousOrderCount) * 100).toFixed(0) : orderCount > 0 ? "100" : "0"}%`,
            )}
          </Section>

          {/* Best sellers */}
          <Section
            style={{
              backgroundColor: white,
              borderRadius: 12,
              padding: "24px 32px",
              marginTop: 16,
            }}
          >
            <Heading
              as="h2"
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 600,
                color: plumDark,
              }}
            >
              This Week&apos;s Best Sellers
            </Heading>
            {bestSellers.length === 0 ? (
              <Text
                style={{
                  margin: "10px 0 0",
                  fontSize: 14,
                  color: muted,
                }}
              >
                No sales recorded this week.
              </Text>
            ) : (
              bestSellers.map((product, index) => (
                <Row
                  key={`${product.name}-${index}`}
                  style={{
                    display: "block",
                    padding: "12px 0",
                    borderBottom:
                      index < bestSellers.length - 1
                        ? `1px solid ${border}`
                        : "none",
                  }}
                >
                  <Text
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 500,
                      color: charcoal,
                    }}
                  >
                    {index + 1}. {product.name}
                  </Text>
                  <Text
                    style={{
                      margin: "2px 0 0",
                      fontSize: 13,
                      color: muted,
                    }}
                  >
                    {product.unitsSold} sold · {formatPrice(product.revenue)}
                  </Text>
                </Row>
              ))
            )}
          </Section>

          {/* Low stock */}
          {lowStock.length > 0 && (
            <Section
              style={{
                backgroundColor: white,
                borderRadius: 12,
                padding: "24px 32px",
                marginTop: 16,
                borderLeft: `3px solid ${plumLight}`,
              }}
            >
              <Heading
                as="h2"
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 600,
                  color: plumDark,
                }}
              >
                Low Stock Alerts
              </Heading>
              {lowStock.map((item, index) => (
                <Text
                  key={`${item.name}-${index}`}
                  style={{
                    margin: "8px 0 0",
                    fontSize: 14,
                    color: charcoal,
                  }}
                >
                  {item.name} — {item.stockQuantity} left (threshold{" "}
                  {item.lowStockThreshold})
                </Text>
              ))}
            </Section>
          )}

          <Hr
            style={{
              border: "none",
              borderTop: `1px solid ${border}`,
              margin: "28px 0 12px",
            }}
          />
          <Text
            style={{
              margin: 0,
              fontSize: 11,
              color: muted,
              textAlign: "center",
            }}
          >
            {BRAND_NAME} · Automated business report
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
