export type Profile = {
  id: string;
  role: string | null;
  firstName: string;
  lastName: string;
  email: string;
  discord: string;
  birthday: string;
  gender: string;
  state: string;
  country: string;
  joined: string;
};

export type ProfileDraft = Pick<Profile, "discord" | "birthday" | "gender" | "state" | "country">;

export function profileDraft(profile: Profile): ProfileDraft {
  return {
    discord: profile.discord,
    birthday: profile.birthday,
    gender: profile.gender,
    state: profile.state,
    country: profile.country,
  };
}
