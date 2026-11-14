import "server-only";
import { defaultNavigation } from "@/config/navigation";
import {
  contactPhoneSchema,
  navigationConfigurationSchema,
} from "@/lib/validation/site-configuration";
import { readWithDatabaseFallback } from "@/server/content/database-fallback";
import { prisma } from "@/server/db";

export const navigationSettingKey = "public_navigation_v1";
export const phoneSettingKey = "public_contact_phone";

export async function getNavigationConfiguration() {
  const setting = await prisma.siteSetting.findUnique({
    where: { key: navigationSettingKey, isPublic: true },
    select: { value: true },
  });
  if (!setting) return defaultNavigation;
  const parsed = navigationConfigurationSchema.safeParse(setting.value);
  if (!parsed.success) {
    console.error("Public navigation settings are invalid.");
    throw new Error("Public navigation settings are invalid.");
  }
  return parsed.data;
}

export async function readNavigationConfiguration() {
  const result = await readWithDatabaseFallback(
    getNavigationConfiguration,
    () => defaultNavigation,
    "Public navigation",
  );
  return result.value;
}

export async function getContactPhone() {
  const setting = await prisma.siteSetting.findUnique({
    where: { key: phoneSettingKey, isPublic: true },
    select: { value: true },
  });
  if (!setting) return "";
  const parsed = contactPhoneSchema.safeParse({ phone: setting.value });
  if (!parsed.success) {
    console.error("Public contact phone setting is invalid.");
    throw new Error("Public contact phone setting is invalid.");
  }
  return parsed.data.phone;
}

export async function readContactPhone() {
  const result = await readWithDatabaseFallback(
    getContactPhone,
    () => "",
    "Public contact phone",
  );
  return result.value;
}
