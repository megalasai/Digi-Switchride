import SwiftUI

struct BrandHeader: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(LinearGradient(colors: [AppColors.greenPrimary, AppColors.greenDark], startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 72, height: 72)
                Image(systemName: "scooter")
                    .font(.system(size: 32, weight: .semibold))
                    .foregroundStyle(.white)
            }
            Text(title)
                .font(.largeTitle.bold())
            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(AppColors.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }
}

struct HubCard: View {
    let name: String
    let distanceKm: Double
    let available: Int
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                RoundedRectangle(cornerRadius: 12)
                    .fill(selected ? AppColors.greenPrimary : AppColors.greenLight)
                    .frame(width: 48, height: 48)
                    .overlay {
                        Image(systemName: "mappin.and.ellipse")
                            .foregroundStyle(selected ? .white : AppColors.greenDark)
                    }
                VStack(alignment: .leading, spacing: 4) {
                    Text(name).font(.headline)
                    Text(String(format: "%.1f km away", distanceKm))
                        .font(.subheadline)
                        .foregroundStyle(AppColors.textSecondary)
                }
                Spacer()
                Label("\(available) free", systemImage: "scooter")
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(AppColors.greenLight)
                    .foregroundStyle(AppColors.greenDark)
                    .clipShape(Capsule())
            }
            .padding(16)
            .background(selected ? AppColors.greenLight : Color(.systemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .shadow(color: .black.opacity(selected ? 0.08 : 0.04), radius: selected ? 8 : 4, y: 2)
        }
        .buttonStyle(.plain)
    }
}

struct VehicleCard: View {
    let model: String
    let registration: String
    let battery: Int
    let onBook: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(model).font(.title3.bold())
                    Text(registration).font(.subheadline).foregroundStyle(AppColors.textSecondary)
                }
                Spacer()
                BatteryBadge(percent: battery)
            }
            Button("Book & Ride", action: onBook)
                .buttonStyle(PrimaryButtonStyle())
        }
        .padding(16)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.06), radius: 6, y: 2)
    }
}

struct BatteryBadge: View {
    let percent: Int

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "battery.100")
            Text("\(percent)%")
                .font(.caption.weight(.semibold))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.batteryColor(for: percent).opacity(0.12))
        .foregroundStyle(Color.batteryColor(for: percent))
        .clipShape(Capsule())
    }
}

struct KycStepRow: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(AppColors.greenPrimary)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline)
                Text(subtitle).font(.subheadline).foregroundStyle(AppColors.textSecondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .foregroundStyle(AppColors.textSecondary)
        }
        .padding(16)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(.separator), lineWidth: 0.5))
    }
}

struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle().fill(AppColors.greenLight).frame(width: 80, height: 80)
                Image(systemName: icon).font(.system(size: 36)).foregroundStyle(AppColors.greenPrimary)
            }
            Text(title).font(.title2.bold())
            Text(message)
                .font(.body)
                .foregroundStyle(AppColors.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct StatusBadge: View {
    let label: String

    var body: some View {
        Text(label)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(AppColors.greenLight)
            .foregroundStyle(AppColors.greenDark)
            .clipShape(Capsule())
    }
}

struct MapPlaceholder: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 16)
            .fill(AppColors.greenLight)
            .frame(height: 160)
            .overlay {
                VStack(spacing: 8) {
                    Image(systemName: "map")
                        .font(.system(size: 36))
                        .foregroundStyle(AppColors.greenPrimary)
                    Text("Map view")
                        .font(.subheadline)
                        .foregroundStyle(AppColors.textSecondary)
                }
            }
    }
}
